function fallbackImage(label = 'WeAllCreate') {
      const cleanLabel = String(label).replace(/&/g, 'and').replace(/[<>]/g, '');
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#8b5cf6"/>
              <stop offset="50%" stop-color="#111827"/>
              <stop offset="100%" stop-color="#06b6d4"/>
            </linearGradient>
          </defs>
          <rect width="900" height="600" fill="url(#g)"/>
          <circle cx="735" cy="120" r="150" fill="rgba(255,255,255,.08)"/>
          <circle cx="140" cy="510" r="180" fill="rgba(255,255,255,.07)"/>
          <text x="50%" y="46%" text-anchor="middle" fill="white" font-family="Arial" font-size="54" font-weight="800">WeAllCreate</text>
          <text x="50%" y="56%" text-anchor="middle" fill="#ddd6fe" font-family="Arial" font-size="30" font-weight="600">${cleanLabel}</text>
        </svg>`;
      return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    function protectImages() {
      document.querySelectorAll('img').forEach(img => {
        img.onerror = function () {
          this.onerror = null;
          this.src = fallbackImage(this.alt || 'Creative Preview');
        };
      });
    }

    const categoryGroups = [
      { group: "Visual Media", icon: "📷", items: ["Photography", "Videography", "Film", "Drone Pilots", "Editors", "Colorists", "Live Streamers", "Photobooth Owners"] },
      { group: "Music & Audio", icon: "🎵", items: ["Artists", "Producers", "DJs", "Audio Engineers", "Songwriters", "Podcast Hosts", "Voice Actors", "Mixing & Mastering"] },
      { group: "Design & Tech", icon: "💻", items: ["Graphic Design", "Branding", "UI/UX Design", "Web Design", "App Development", "Game Development", "3D Modeling", "Motion Graphics"] },
      { group: "Art & Writing", icon: "🎨", items: ["Illustration", "Painting", "Digital Art", "Street Art", "Poets", "Writers", "Authors", "Journalists"] },
      { group: "Fashion & Beauty", icon: "✨", items: ["Fashion Design", "Stylists", "Models", "Makeup Artists", "Hair Stylists", "Barbers", "Nail Techs", "Tattoo Artists"] },
      { group: "Business & Content", icon: "📈", items: ["Content Creators", "Influencers", "Social Media Managers", "Marketers", "Entrepreneurs", "E-commerce", "Copywriters", "Brand Strategists"] },
      { group: "Lifestyle & Events", icon: "🎤", items: ["Event Planners", "Hosts", "Chefs", "Bakers", "Food Creators", "Fitness Trainers", "Coaches", "Travel Creators"] },
      { group: "Local Services", icon: "🔧", items: ["Mechanics", "Car Detailers", "Car Customizers", "Interior Designers", "Architects", "Real Estate Creators", "Tutors", "Course Creators"] }
    ];

    const profiles = [
      { name: "Chance Visuals", category: "Photography", lane: "Visual Media", location: "Atlanta", price: "mid", available: true, specialty: "Cinematic photo and video work for artists, brands, and street visuals.", image: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80" },
      { name: "Nova Sound", category: "Music", lane: "Music & Audio", location: "Atlanta", price: "mid", available: true, specialty: "Recording sessions, artist development, hooks, and studio recaps.", image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80" },
      { name: "Elite Cuts", category: "Barbers", lane: "Fashion & Beauty", location: "Decatur", price: "budget", available: true, specialty: "Clean fades, transformations, and barber content shoots.", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80" },
      { name: "Mia Creates", category: "Design", lane: "Design & Tech", location: "Remote", price: "mid", available: false, specialty: "Flyers, brand identity, digital graphics, and launch visuals.", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80" },
      { name: "Chef Ray", category: "Food", lane: "Lifestyle & Events", location: "Atlanta", price: "premium", available: true, specialty: "Private plates, food content, catering visuals, and pop-up events.", image: "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=900&q=80" },
      { name: "Auto Detail King", category: "Mechanics", lane: "Local Services", location: "Griffin", price: "mid", available: true, specialty: "Car detailing, custom work, before-and-after content, and repair showcases.", image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80" },
      { name: "Kali Ink", category: "Tattoo Artists", lane: "Fashion & Beauty", location: "Atlanta", price: "premium", available: false, specialty: "Fine line tattoos, custom artwork, and studio content.", image: "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=900&q=80" },
      { name: "BuildMode Dev", category: "Web Design", lane: "Design & Tech", location: "Remote", price: "premium", available: true, specialty: "Websites, landing pages, portfolios, and startup MVPs.", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80" },
      { name: "Verse Room", category: "Writers", lane: "Art & Writing", location: "Remote", price: "budget", available: true, specialty: "Poetry, captions, artist bios, blog writing, and brand storytelling.", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80" }
    ];

    let savedCreators = [];
    let savedProducts = [];
    let savedPosts = [];
    let savedCollabs = [];

    const products = [
      { name: "Cinematic Lightroom Preset Pack", creator: "Chance Visuals", type: "Presets", lane: "Photography", price: 15, description: "Clean cinematic tones for street photos, portraits, and night shoots.", image: "https://images.unsplash.com/photo-1492724441997-5dc865305da7?auto=format&fit=crop&w=900&q=80" },
      { name: "Music Artist Growth Guide", creator: "Nova Sound", type: "Guidebook", lane: "Music", price: 25, description: "A step-by-step guide for independent artists building their brand and release strategy.", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80" },
      { name: "Barber Marketing Ebook", creator: "Elite Cuts", type: "Guidebook", lane: "Beauty", price: 10, description: "A simple guide to help barbers grow clientele through content and local branding.", image: "https://images.unsplash.com/photo-1512499617640-c2f999098c01?auto=format&fit=crop&w=900&q=80" },
      { name: "Logo Design Template Pack", creator: "Mia Creates", type: "Templates", lane: "Design", price: 20, description: "Editable starter templates for logos, flyers, and brand identity projects.", image: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80" },
      { name: "Producer Beat Starter Pack", creator: "Nova Sound", type: "Beats", lane: "Music", price: 35, description: "A pack of beats, loops, and stems for upcoming artists and producers.", image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=900&q=80" },
      { name: "Photo Business Starter Guide", creator: "Chance Visuals", type: "Guidebook", lane: "Business", price: 30, description: "A practical guide for pricing shoots, finding clients, and building a creative brand.", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80" },
      { name: "Fitness Content Calendar", creator: "Coach Lane", type: "Templates", lane: "Fitness", price: 12, description: "A content planning template for trainers, coaches, and wellness creators.", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80" },
      { name: "Client Onboarding Kit", creator: "BuildMode Dev", type: "Services Kit", lane: "Business", price: 55, description: "Forms, checklists, and templates for creators who book clients regularly.", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80" }
    ];

    profiles.push(...savedCreators);
    products.push(...savedProducts);

    const creations = profiles.slice(0, 4).map((p, i) => ({
      title: ["Downtown Night Shoot", "Studio Session Recap", "Fresh Fade Showcase", "Custom Brand Flyer"][i],
      creator: p.name,
      category: p.category,
      description: p.specialty,
      image: p.image,
      likes: [248, 410, 182, 326][i],
      comments: [34, 52, 21, 47][i]
    }));

    const collabs = [
      { title: "Looking for a videographer for a music video in Atlanta", status: "Open", tag: "Video" },
      { title: "Photographer needed for a streetwear brand shoot", status: "Open", tag: "Photography" },
      { title: "Producer looking for artists to build a 3-song EP", status: "In Progress", tag: "Music" },
      { title: "Barber seeking content creator for weekly transformation reels", status: "Open", tag: "Beauty" },
      { title: "Chef looking for a food photographer for a pop-up menu launch", status: "Completed", tag: "Food" },
      { title: "Web designer needed for a personal brand portfolio", status: "Open", tag: "Web" }
    ];

    const communityPosts = [
      { author: "Chance Visuals", tag: "Feedback", text: "Working on a new night photography preset pack. What type of look do y’all like more: clean cinematic or heavy vintage?", stats: "42 likes · 18 comments" },
      { author: "Nova Sound", tag: "Opportunity", text: "Looking for 2 artists in Atlanta who need studio recap content for their next rollout.", stats: "61 likes · 24 comments" },
      { author: "Mia Creates", tag: "Design Talk", text: "Branding tip: your visuals should tell people what you do before they even read your bio.", stats: "88 likes · 31 comments" },
      { author: "Elite Cuts", tag: "Growth", text: "Barbers, start filming transformations. People trust what they can see.", stats: "73 likes · 15 comments" },
      { author: "Coach Lane", tag: "Fitness", text: "Consistency beats motivation. Build systems for your content.", stats: "39 likes · 12 comments" },
      { author: "BuildMode Dev", tag: "Web", text: "Creators need websites. Social media alone isn’t enough long term.", stats: "55 likes · 20 comments" }
    ];

    const messages = [
      { name: "Chance Visuals", preview: "I can shoot that this weekend. What location were you thinking?" },
      { name: "Mia Creates", preview: "Send over the logo ideas and I’ll mock up a direction." },
      { name: "Nova Sound", preview: "The beat pack is ready. I can send the link after checkout." },
      { name: "Elite Cuts", preview: "I got availability Friday and Saturday." },
      { name: "BuildMode Dev", preview: "I can build your site in about 3 days." }
    ];

    const groups = [
      { name: "Atlanta Creatives", icon: "🌆", description: "For photographers, artists, models, barbers, musicians, and creators building in Atlanta." },
      { name: "Photographers Only", icon: "📷", description: "Talk gear, editing, locations, presets, bookings, and portfolio growth." },
      { name: "Music Producers", icon: "🎹", description: "Share beats, find artists, trade feedback, and build placements." },
      { name: "Barbers & Beauty Creators", icon: "💈", description: "Content ideas, client growth, transformation videos, and booking tips." },
      { name: "Design & Branding", icon: "🎨", description: "Logos, flyers, websites, UI/UX, brand identity, and creative feedback." },
      { name: "Business Builders", icon: "📈", description: "Pricing, marketing, contracts, digital products, sales, and scaling." },
      { name: "Videographers", icon: "🎥", description: "Camera setups, edits, client work, and music video shoots." },
      { name: "Content Creators", icon: "📱", description: "TikTok, Instagram, YouTube growth and content strategy." }
    ];

    const reviews = [
      { name: "Chance Visuals", rating: "★★★★★", text: "Professional, creative, and easy to work with. The visuals came out clean." },
      { name: "Nova Sound", rating: "★★★★★", text: "The guide helped me understand how to plan my rollout better." },
      { name: "Elite Cuts", rating: "★★★★☆", text: "Great service and the content looked good for my brand page." },
      { name: "Mia Creates", rating: "★★★★★", text: "Amazing designs. Helped bring my brand to life." },
      { name: "BuildMode Dev", rating: "★★★★★", text: "Website came out clean and professional." }
    ];

    const services = [
      { title: "Portrait Photoshoot", creator: "Chance Visuals", price: "$125+", category: "Photography", description: "Outdoor or studio-style portraits with edited final images." },
      { title: "Music Video Package", creator: "Chance Visuals", price: "$250+", category: "Video", description: "Performance video, simple creative direction, and edited final cut." },
      { title: "Logo Design", creator: "Mia Creates", price: "$75+", category: "Design", description: "Custom logo concepts for brands, creators, and small businesses." },
      { title: "Beat Pack / Custom Beat", creator: "Nova Sound", price: "$50+", category: "Music", description: "Beat licensing, custom production, and artist sound development." },
      { title: "Barber Content Shoot", creator: "Elite Cuts", price: "$100+", category: "Beauty", description: "Short-form transformation reels and photo content for barber brands." },
      { title: "Website Landing Page", creator: "BuildMode Dev", price: "$300+", category: "Web Design", description: "One-page website for creators, brands, campaigns, or businesses." },
      { title: "Fitness Coaching Plan", creator: "Coach Lane", price: "$80+", category: "Fitness", description: "Personalized workout and diet plan with weekly check-ins." }
    ];

    const extraSuggestions = [
      "Add a beta waitlist so people can sign up before the full launch.",
      "Add featured city pages like Atlanta Creatives, Decatur Creatives, and Griffin Creatives.",
      "Add a creator verification badge to make profiles feel trustworthy.",
      "Add a saved/favorites feature so users can save creators, posts, and products.",
      "Add a report button for fake profiles, stolen work, spam, or unsafe behavior.",
      "Add a featured business section for brands looking to hire multiple creators.",
      "Add an events section for pop-ups, shoots, networking events, and creative meetups.",
      "Add creator analytics later so users can track profile views, product clicks, and bookings."
    ];

    const notifications = [
      "Nova Sound replied to your collab request",
      "Someone viewed your marketplace product",
      "Mia Creates commented on your post",
      "New review received on your profile"
    ];

    communityPosts.push(...savedPosts);
    collabs.push(...savedCollabs);

    function showPage(pageId) {
      document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
      document.getElementById(pageId).classList.add("active");
      document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
      document.querySelectorAll(".nav-btn").forEach(btn => {
        if (btn.textContent.toLowerCase() === pageId) btn.classList.add("active");
        if (pageId === "home" && btn.textContent === "Home") btn.classList.add("active");
        if (pageId === "marketplace" && btn.textContent === "Marketplace") btn.classList.add("active");
      });
      protectImages();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function createWorkCard(item) {
      return `
        <button class="creation-card" data-onclick='openDetail(${JSON.stringify(item)})'>
          <img src="${item.image}" alt="${item.title}">
          <div class="creation-content">
            <div class="tag-row"><span class="tag">${item.category}</span><span class="creator-name">by ${item.creator}</span></div>
            <h3>${item.title}</h3><p>${item.description}</p>
            <div class="stats">♡ ${item.likes} &nbsp;&nbsp; 💬 ${item.comments}</div>
          </div>
        </button>`;
    }

    function createProfileCard(profile) {
      return `
        <div class="profile-card">
          <img src="${profile.image}" alt="${profile.name}">
          <div class="profile-content">
            <div class="tag-row"><span class="tag">${profile.category}</span><span class="creator-name">${profile.location}</span></div>
            <h3>${profile.name}</h3>
            <p>${profile.specialty}</p>
            <div class="stats">${profile.available ? "Available Now" : "Booked"} · ${profile.price === "budget" ? "Budget Friendly" : profile.price === "mid" ? "Mid Range" : "Premium"}</div>
            <div class="card-actions">
              <button class="mini-btn primary" data-onclick="openBooking('${profile.name}')">Hire Me</button>
              <button class="mini-btn" data-onclick="openProfile('${profile.name}')">View Profile</button>
            </div>
          </div>
        </div>`;
    }

    function createProductCard(product) {
      return `
        <div class="product-card">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-content">
            <div class="tag-row"><span class="tag">${product.type}</span><span class="creator-name">by ${product.creator}</span></div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="price">$${product.price}</div>
            <div class="card-actions">
              <button class="mini-btn primary" disabled>Example listing</button>
              <button class="mini-btn" data-onclick="openProfile('${product.creator}')">View Creator</button>
            </div>
          </div>
        </div>`;
    }

    function renderHome() {
      document.getElementById("home-categories").innerHTML = categoryGroups.map(group => `
        <button class="category-card" data-onclick="showPage('categories')">
          <div class="category-icon">${group.icon}</div><strong>${group.group}</strong><span>${group.items.slice(0,4).join(", ")}</span>
        </button>`).join("");
      document.getElementById("home-feed").innerHTML = creations.map(createWorkCard).join("");
      document.getElementById("trending-creators").innerHTML = profiles.slice(0,4).map(p => `<div class="creator-list-item"><div class="avatar">${p.name[0]}</div><div><strong>${p.name}</strong><br><span class="creator-name">${p.category} · ${p.location}</span></div></div>`).join("");
    }

    function renderCategories() {
      document.getElementById("category-directory").innerHTML = categoryGroups.map(group => `
        <div class="card category-group">
          <div class="category-icon">${group.icon}</div><h2>${group.group}</h2>
          <div class="subcategory-list">${group.items.map(item => `<span>${item}</span>`).join("")}</div>
        </div>`).join("");
      const categorySelect = document.getElementById("categoryFilter");
      categorySelect.innerHTML = `<option value="All">All Categories</option>` + categoryGroups.flatMap(g => [g.group, ...g.items]).map(item => `<option>${item}</option>`).join("");
    }

    function renderProfiles() {
      const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
      const category = document.getElementById("categoryFilter")?.value || "All";
      const location = document.getElementById("locationFilter")?.value || "All";
      const price = document.getElementById("priceFilter")?.value || "All";
      const filtered = profiles.filter(p => {
        const matchesSearch = `${p.name} ${p.category} ${p.lane} ${p.location} ${p.specialty} ${p.available ? "available" : "booked"}`.toLowerCase().includes(search);
        const matchesCategory = category === "All" || p.category === category || p.lane === category;
        const matchesLocation = location === "All" || p.location === location;
        const matchesPrice = price === "All" || p.price === price;
        return matchesSearch && matchesCategory && matchesLocation && matchesPrice;
      });
      document.getElementById("profile-grid").innerHTML = filtered.length ? filtered.map(createProfileCard).join("") : `<div class="card info-box"><h2>No creators found yet</h2><p>Try a different category, location, or search term.</p></div>`;
    }

    function renderMarketplace() {
      const search = document.getElementById("productSearch")?.value.toLowerCase() || "";
      const type = document.getElementById("productTypeFilter")?.value || "All";
      const price = document.getElementById("productPriceFilter")?.value || "All";
      const lane = document.getElementById("productCategoryFilter")?.value || "All";
      const filtered = products.filter(p => {
        const matchesSearch = `${p.name} ${p.creator} ${p.type} ${p.lane} ${p.description}`.toLowerCase().includes(search);
        const matchesType = type === "All" || p.type === type;
        const matchesLane = lane === "All" || p.lane === lane;
        const matchesPrice = price === "All" || (price === "under20" && p.price < 20) || (price === "20to50" && p.price >= 20 && p.price <= 50) || (price === "over50" && p.price > 50);
        return matchesSearch && matchesType && matchesLane && matchesPrice;
      });
      document.getElementById("marketplace-grid").innerHTML = filtered.length ? filtered.map(createProductCard).join("") : `<div class="card info-box"><h2>No products found yet</h2><p>Try a different product type, price, or search term.</p></div>`;
    }

    function quickFilter(value) {
      document.getElementById("searchInput").value = value === "Available Now" ? "available" : value;
      renderProfiles();
    }

    function clearFilters() {
      document.getElementById("searchInput").value = "";
      document.getElementById("categoryFilter").value = "All";
      document.getElementById("locationFilter").value = "All";
      document.getElementById("priceFilter").value = "All";
      renderProfiles();
    }

    function openDetail(item) {
      document.getElementById("detail-title").textContent = item.title;
      document.getElementById("detail-creator").textContent = "Created by " + item.creator;
      document.getElementById("detail-image").src = item.image;
      document.getElementById("detail-description").textContent = item.description;
      document.getElementById("detail-card-creator").textContent = item.creator;
      document.getElementById("detail-avatar").textContent = item.creator[0];
      showPage("detail");
    }

    function openBooking(name) {
      document.getElementById("bookingCreator").value = name;
      showPage("booking");
    }

    function openBookingFromDetail() {
      openBooking(document.getElementById("detail-card-creator").textContent);
    }

    function openProfile(name) {
      const profile = profiles.find(p => p.name === name);
      if (!profile) return;
      openDetail({ title: profile.name + " Profile", creator: profile.name, category: profile.category, description: profile.specialty, image: profile.image, likes: 0, comments: 0 });
    }

    function renderCollabs() {
      document.getElementById("collab-feed").innerHTML = collabs.map(item => `
        <div class="card collab-request">
          <div class="tag-row"><span class="tag">${item.tag}</span><span class="creator-name">${item.status}</span></div>
          <h3>${item.title}</h3>
          <p>Message creator, apply to collaborate, or follow the project status.</p><br>
          <button class="mini-btn primary">Apply to Collab</button>
          <button class="mini-btn" data-onclick="showPage('messages')">Message</button>
        </div>`).join("");
    }

    function renderCommunity() {
      document.getElementById("community-feed").innerHTML = communityPosts.map(post => `
        <div class="card info-box">
          <div class="tag-row"><span class="tag">${post.tag}</span><span class="creator-name">${post.author}</span></div>
          <p>${post.text}</p>
          <div class="stats">${post.stats}</div>
          <div class="card-actions">
            <button class="mini-btn">Like</button>
            <button class="mini-btn">Comment</button>
            <button class="mini-btn primary" data-onclick="showPage('messages')">Message</button>
          </div>
        </div>`).join("");

      document.getElementById("notification-list").innerHTML = notifications.map(note => `<p style="border-bottom:1px solid rgba(255,255,255,.1); padding:10px 0;">${note}</p>`).join("");
    }

    function renderMessages() {
      document.getElementById("message-list").innerHTML = messages.map(msg => `
        <button class="creator-list-item" style="width:100%; background:transparent; color:white; text-align:left;" data-onclick="openChat('${msg.name}')">
          <div class="avatar">${msg.name[0]}</div><div><strong>${msg.name}</strong><br><span class="creator-name">${msg.preview}</span></div>
        </button>`).join("");
      openChat("Chance Visuals");
    }

    function openChat(name) {
      document.getElementById("chat-title").textContent = name;
      document.getElementById("chat-window").innerHTML = `
        <div class="card info-box" style="margin:0;"><p><strong>${name}:</strong> Appreciate you reaching out. What are you trying to create?</p></div>
        <div class="card info-box" style="margin:0; background:rgba(139,92,246,.14);"><p><strong>You:</strong> I’m interested in booking and possibly collaborating.</p></div>
        <div class="card info-box" style="margin:0;"><p><strong>${name}:</strong> Bet, send me the details and budget range.</p></div>`;
    }

    function renderGroups() {
      document.getElementById("group-grid").innerHTML = groups.map(group => `
        <div class="card category-group">
          <div class="category-icon">${group.icon}</div>
          <h2>${group.name}</h2>
          <p class="muted">${group.description}</p><br>
          <button class="mini-btn primary">Join Group</button>
          <button class="mini-btn" data-onclick="showPage('community')">View Posts</button>
        </div>`).join("");
    }

    function renderReviews() {
      document.getElementById("reviews-grid").innerHTML = reviews.map(review => `
        <div class="card creator-card">
          <div class="avatar">${review.name[0]}</div>
          <h3>${review.name}</h3>
          <div class="price">${review.rating}</div>
          <p>${review.text}</p>
        </div>`).join("");
    }

    function renderServices() {
      const grid = document.getElementById("services-grid");
      if (!grid) return;
      grid.innerHTML = services.map(service => `
        <div class="card creator-card">
          <span class="tag">${service.category}</span>
          <h2 style="margin-top:14px;">${service.title}</h2>
          <p class="muted">by ${service.creator}</p>
          <div class="price">${service.price}</div>
          <p>${service.description}</p>
          <div class="card-actions">
            <button class="mini-btn primary" data-onclick="openBooking('${service.creator}')">Book Service</button>
            <button class="mini-btn" data-onclick="openProfile('${service.creator}')">View Creator</button>
          </div>
        </div>`).join("");
    }

    function renderSpotlight() {
      document.getElementById("spotlight-grid").innerHTML = profiles.slice(1,4).map(createProfileCard).join("");
    }

    function addCreator(event) {
      event.preventDefault();
      const creator = {
        name: document.getElementById('newCreatorName').value,
        category: document.getElementById('newCreatorCategory').value,
        lane: document.getElementById('newCreatorCategory').value,
        location: document.getElementById('newCreatorLocation').value,
        price: document.getElementById('newCreatorPrice').value,
        available: true,
        specialty: document.getElementById('newCreatorSpecialty').value,
        image: document.getElementById('newCreatorImage').value || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80'
      };
      savedCreators.push(creator);
      localStorage.setItem('weallcreate_creators', JSON.stringify(savedCreators));
      profiles.push(creator);
      event.target.reset();
      refreshAll();
      alert('Creator added. Check Explore to see it.');
    }

    function addProduct(event) {
      event.preventDefault();
      const product = {
        name: document.getElementById('newProductName').value,
        creator: document.getElementById('newProductCreator').value,
        type: document.getElementById('newProductType').value,
        lane: document.getElementById('newProductLane').value,
        price: Number(document.getElementById('newProductPrice').value),
        description: document.getElementById('newProductDescription').value,
        image: document.getElementById('newProductImage').value || 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80'
      };
      savedProducts.push(product);
      localStorage.setItem('weallcreate_products', JSON.stringify(savedProducts));
      products.push(product);
      event.target.reset();
      refreshAll();
      alert('Product added. Check Marketplace to see it.');
    }

    function addCommunityPost(event) {
      event.preventDefault();
      const post = {
        author: document.getElementById('newPostAuthor').value,
        tag: document.getElementById('newPostTag').value,
        text: document.getElementById('newPostText').value,
        stats: '0 likes · 0 comments'
      };
      savedPosts.push(post);
      localStorage.setItem('weallcreate_posts', JSON.stringify(savedPosts));
      communityPosts.push(post);
      event.target.reset();
      refreshAll();
      alert('Post added. Check Community to see it.');
    }

    function addCollab(event) {
      event.preventDefault();
      const collab = {
        title: document.getElementById('newCollabTitle').value,
        tag: document.getElementById('newCollabTag').value,
        status: document.getElementById('newCollabStatus').value
      };
      savedCollabs.push(collab);
      localStorage.setItem('weallcreate_collabs', JSON.stringify(savedCollabs));
      collabs.push(collab);
      event.target.reset();
      refreshAll();
      alert('Collab request added. Check Collab to see it.');
    }

    function clearDashboardData() {
      localStorage.removeItem('weallcreate_creators');
      localStorage.removeItem('weallcreate_products');
      localStorage.removeItem('weallcreate_posts');
      localStorage.removeItem('weallcreate_collabs');
      alert('Test data cleared. Refresh the page.');
    }

    function refreshAll() {
      renderHome();
      renderCategories();
      renderProfiles();
      renderMarketplace();
      renderCollabs();
      renderCommunity();
      renderMessages();
      renderGroups();
      renderReviews();
      renderServices();
      renderSpotlight();
      renderSuggestions();
    }

    function renderSuggestions() {
      const box = document.getElementById('extra-suggestions');
      if (!box) return;
      box.innerHTML = extraSuggestions.map(item => `<p style="border-bottom:1px solid rgba(255,255,255,.1); padding:10px 0;">${item}</p>`).join('');
    }


