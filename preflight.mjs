const missing=[];const env=process.env;
for(const key of ['APP_ORIGIN','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID','RESEND_API_KEY','EMAIL_FROM','ADMIN_EMAILS','BACKUP_ENCRYPTION_KEY','SUPPORT_EMAIL'])if(!env[key]||env[key].includes('REPLACE'))missing.push(key);
const errors=[];
if(!/^https:\/\/[^/]+$/.test(env.APP_ORIGIN||''))errors.push('APP_ORIGIN must be an HTTPS origin without a trailing slash.');
if(!env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))errors.push('A Stripe test key is required; live payments remain disabled.');
if(!/^[a-f0-9]{64}$/i.test(env.BACKUP_ENCRYPTION_KEY||''))errors.push('BACKUP_ENCRYPTION_KEY must contain 32 bytes encoded as 64 hexadecimal characters.');
if(!env.DATABASE_PATH?.startsWith('/app/data/'))errors.push('Set DATABASE_PATH=/app/data/weallcreate.sqlite and mount persistent storage at /app/data.');
console.log(JSON.stringify({ready:missing.length===0&&errors.length===0,missing,errors},null,2));if(missing.length||errors.length)process.exitCode=1;
