import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,unlinkSync,rmdirSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBackup,decryptFile} from './backups.mjs';
test('encrypted backup restores a consistent database and private uploaded file',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'wac-backup-')),path=join(folder,'site.sqlite'),uploads=join(folder,'uploads');mkdirSync(uploads);const db=new DatabaseSync(path);db.exec("CREATE TABLE uploads(id TEXT); INSERT INTO uploads VALUES('file-id'); CREATE TABLE example(value TEXT); INSERT INTO example VALUES('preserved');");writeFileSync(join(uploads,'file-id'),'Private file content');const key='a'.repeat(64);let backupFolder;
 t.after(()=>{db.close();for(const p of [backupFolder,join(folder,'backups'),uploads,folder])if(p){for(const f of readdirSync(p,{withFileTypes:true}))if(f.isFile())unlinkSync(join(p,f.name));rmdirSync(p);}});
 backupFolder=await createBackup(db,path,uploads,key);assert.equal(readFileSync(join(backupFolder,'database.enc')).includes(Buffer.from('preserved')),false);const restored=join(folder,'restored.sqlite');await decryptFile(join(backupFolder,'database.enc'),restored,key);const check=new DatabaseSync(restored);assert.equal(check.prepare('SELECT value FROM example').get().value,'preserved');check.close();const file=join(folder,'restored-file');await decryptFile(join(backupFolder,'file-id.enc'),file,key);assert.equal(readFileSync(file,'utf8'),'Private file content');await assert.rejects(decryptFile(join(backupFolder,'file-id.enc'),join(folder,'bad-file'),'b'.repeat(64)));
});
