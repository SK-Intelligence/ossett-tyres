(function () {
  "use strict";

  const config = Object.assign(
    {
      contactEmail: "ossettwholesale@gmail.com",
      phone: "07380439443",
    },
    window.OSSETT_CONFIG || {},
  );
  const siteUtils = window.OssettSiteUtils;
  const phoneHref = siteUtils.telephoneHref(config.phone);
  const whatsappNumber = siteUtils.whatsappNumber(config.phone);

  const tyreApi = window.OssettTyreApi || null;
  let tyreClient = null;
  let tyreConfigError = null;
  let reviewTimer = null;
  if (tyreApi) {
    try {
      tyreClient = tyreApi.createClient();
    } catch (error) {
      tyreConfigError = error;
    }
  } else {
    tyreConfigError = new Error("The tyre API adapter did not load.");
  }

  const navItems = [
    ["/", "Home"],
    ["/services", "Services"],
    ["/blog", "Blog"],
    ["/contact-us", "Contact Us"],
    ["/order-your-tyres-online", "Order Your Tyres Online"],
  ];

  const socialLinks = [
    {
      name: "Facebook",
      href: "https://www.facebook.com/ossetttyres",
      icon: '<path d="M13.3 22v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7V14h2.9v8h3.4Z"/>',
    },
    {
      name: "Instagram",
      href: "https://www.instagram.com/ossetttyres/",
      icon: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.7" cy="6.4" r="1.15"/>',
    },
    {
      name: "LinkedIn",
      href: "https://www.linkedin.com/company/ossett-tyres/",
      icon: '<path d="M6.3 8.2H3.4V21h2.9V8.2ZM4.8 3A1.8 1.8 0 1 0 4.8 6.6 1.8 1.8 0 0 0 4.8 3Zm8.2 5.2h-2.8V21H13v-6.3c0-1.7.3-3.3 2.4-3.3 2 0 2.1 1.9 2.1 3.4V21h2.9v-7c0-3.4-.7-6-4.7-6a4.1 4.1 0 0 0-3.7 2h-.1V8.2Z"/>',
    },
    {
      name: "X",
      href: "https://x.com/ossetttyres",
      icon: '<path d="M5 4h4.3l3.6 5.1L17.2 4H19l-5.3 6.3L20 20h-4.3l-4-5.7L6.9 20H5l5.8-6.9L5 4Zm3.4 1.5H7.8l8.7 13h.7l-8.8-13Z"/>',
    },
  ];

  const brands = [
    ["Yokohama", "assets/brands/yokohama.png"],
    ["West Lake Tires", "assets/brands/west-lake.png"],
    ["Uniroyal", "assets/brands/uniroyal.png"],
    ["Pirelli", "assets/brands/pirelli.png"],
    ["Triangle", "assets/brands/triangle.png"],
    ["Roadstone", "assets/brands/roadstone.png"],
    ["Michelin", "assets/brands/michelin.png"],
    ["Hankook", "assets/brands/hankook.png"],
    ["Riken", "assets/brands/riken.png"],
    ["Prestivo Performance Tyres", "assets/brands/prestivo.png"],
    ["Nexen Tire", "assets/brands/nexen.png"],
    ["Goodyear", "assets/brands/goodyear.png"],
    ["Maxxis", "assets/brands/maxxis.png"],
    ["Matador", "assets/brands/matador.png"],
    ["Continental", "assets/brands/continental.png"],
    ["Bridgestone", "assets/brands/bridgestone.png"],
    ["Leao Tire", "assets/brands/leao.png"],
    ["Dunlop", "assets/brands/dunlop.png"],
    ["Giti", "assets/brands/giti.png"],
    ["Avon Tyres", "assets/brands/avon.png"],
  ];

  const reviews = [
    {
      name: "C Crook",
      initial: "C",
      copy: "Got four tyres replaced, fast service, great price, friendly and helpful. Would definitely go there again.",
    },
    {
      name: "Pav L.",
      initial: "P",
      copy: "Quick turnaround, great pricing. Sourced some wheel nuts for me for the following day. Highly recommended.",
    },
    {
      name: "Jonjo Hancock Fell",
      initial: "J",
      copy: "Really great - had an emergency with a puncture, turned up and they sorted me a new tyre straightaway. Recommended!",
    },
  ];

  const articles = {
    "/blog-post1": {
      title: "The Most Reliable Cars for New Drivers in 2023",
      date: "8/28/2025",
      read: "5 min read",
      imageClass: "blog-car",
      alt: "a red car parked in a parking lot",
      sections: [
        [
          "Introduction to Car Reliability",
          "Reliability describes how likely a car is to keep working without repeated mechanical faults or unexpected breakdowns. It matters to every buyer, but especially to a new driver who needs safe, dependable transport while gaining experience on the road.",
          "Build quality is one of the foundations of reliability. Strong materials, careful assembly and components designed to last generally mean fewer problems as a vehicle gets older.",
          "A manufacturer’s reputation is useful evidence too. Carmakers known for dependable models tend to invest in engineering, testing and quality control, while sensible maintenance costs help owners keep the vehicle in good condition without creating financial strain.",
          "Safety technology also contributes to a dependable first car. Features that help prevent collisions, together with predictable handling and responsive controls, give an inexperienced driver more confidence and control.",
          "A reliable car can also be cost-effective through better fuel economy, manageable insurance and fewer repair bills. That peace of mind lets a new driver concentrate on improving their skills instead of worrying about the next breakdown.",
        ],
        [
          "Top Reliable Cars for New Drivers",
          "Several 2023 models stand out for combining affordability, safety and dependable ownership, making them practical choices for someone buying an early car.",
          "The Toyota Corolla has a long reputation for resilience and practicality. Its strong fuel economy, comfortable ride, automatic emergency braking and lane-support technology make it particularly approachable for a new driver.",
          "The Honda Civic pairs durable engineering with an enjoyable drive, a roomy interior and strong safety results. Its efficient fuel use also helps a novice motorist keep everyday running costs under control.",
          "The Hyundai Elantra combines modern styling with easy-to-use technology, good safety performance and a comprehensive warranty. Those qualities make it an attractive hatchback-style option for a first-time owner.",
          "For drivers who prefer a compact SUV, the Subaru Crosstrek offers standard all-wheel drive, extra ground clearance and driver-assistance features. Its dependable record makes it useful across a wider range of road and weather conditions.",
          "Reliability ratings and owner feedback support these choices. Selecting a car with a proven record gives a new driver a safer, more reassuring start to independent motoring.",
        ],
        [
          "Factors to Consider When Choosing a Reliable Car",
          "Fuel efficiency should be considered early because new drivers are often working within a tight budget. A car that travels farther on each litre reduces ongoing costs as well as its environmental impact.",
          "Vehicle size matters too. A compact car is usually easier to position, park and manoeuvre through busy or narrow streets while a novice is still developing spatial awareness.",
          "Insurance costs can vary greatly between models, so quotations should be checked before buying. Choosing a car in a more affordable insurance group can make a major difference to the total cost of ownership.",
          "Resale value is another useful measure. Models that depreciate more slowly leave an owner in a stronger position when it is time to change or upgrade the vehicle.",
          "Modern safety equipment such as stability control, lane-departure warnings and automatic emergency braking offers valuable extra protection for an inexperienced driver.",
          "Finally, research the individual vehicle’s history and reliability record, then take a proper test drive to assess comfort and handling. Understanding likely servicing costs, finance choices and the room available for negotiation helps ensure the final purchase suits both practical needs and budget.",
        ],
        [
          "Maintenance Tips for Ensuring Long-Term Reliability",
          "Regular servicing is essential to long-term reliability. New drivers should learn the schedule in the owner’s manual and follow the manufacturer’s intervals for engine oil, brakes, transmission and other major components.",
          "Keeping to that schedule allows small faults to be addressed before they develop into expensive repairs or leave the vehicle unusable.",
          "Tyres need regular attention as well. Correct pressure supports safe handling and fuel efficiency, while rotation and tread-depth checks promote even wear. Worn brake pads should also be dealt with promptly.",
          "Engine oil, coolant, brake fluid and transmission fluid should be inspected at suitable intervals. Low levels can cause serious damage, and dashboard warning lights should never be ignored because they often signal that a check or refill is required.",
          "A maintenance log recording service dates, replacement parts and fluid changes gives both the driver and mechanic a clear picture of the car’s condition. Building a relationship with a trusted garage also makes it easier to receive advice tailored to the vehicle.",
          "Combining these habits helps a new driver protect both the reliability and the useful life of their car.",
        ],
      ],
    },
    "/blog-post": {
      title: "10 Effective Ways to Increase Your Car's Longevity",
      date: "8/28/2025",
      read: "4 min read",
      imageClass: "blog-service",
      alt: "person in black jacket driving car",
      sections: [
        [
          "Regular Maintenance: The Key to Longevity",
          "A vehicle’s lifespan depends heavily on the maintenance it receives. Following the manufacturer’s service schedule preserves performance and efficiency through routine oil changes, tyre rotations, brake inspections and fluid checks.",
          "Fresh engine oil lubricates moving parts and limits friction, while rotating the tyres encourages even wear and dependable grip. Both jobs help important components last longer.",
          "Brake inspections protect safety and can reveal worn pads or low fluid before further damage occurs. The same preventive approach can catch a small oil leak or another minor fault before it becomes a costly repair.",
          "Staying proactive therefore improves reliability, controls repair costs and supports a safer, more efficient driving experience throughout the life of the car.",
        ],
        [
          "Driving Habits That Promote Longevity",
          "Driving style has a direct effect on wear. Gradual acceleration and deceleration reduce the strain placed on the engine, transmission and brakes compared with repeated aggressive starts and stops.",
          "Maintaining a smooth, steady pace gives mechanical components gentler transitions and helps prevent unnecessary wear over time.",
          "Keeping within speed limits reduces engine workload and fuel consumption. It can therefore benefit both the life of the engine and the cost of running the vehicle.",
          "Drivers should anticipate junctions and traffic so they can brake progressively. Hard braking, rapid lane changes and tailgating all increase wear and can shorten the service life of tyres and braking components.",
          "Long periods of idling waste fuel and place unnecessary demand on the engine. Turning the car off during a prolonged wait, where safe and appropriate, is another simple way to protect efficiency and longevity.",
        ],
        [
          "The Importance of Quality Fuel and Fluids",
          "Fuel and fluid quality influence both engine performance and long-term durability. Using the grade recommended for the vehicle supports efficient combustion, whereas unsuitable low-quality fuel can leave deposits and reduce efficiency.",
          "Impurities and incomplete combustion can create carbon build-up within important engine components, increasing wear as mileage accumulates.",
          "Engine oil, transmission fluid, brake fluid and coolant should all meet the manufacturer’s specification. Incorrect or substandard products can cause overheating, poor lubrication and, in severe cases, component failure.",
          "Engine oil is especially important because it lubricates and helps cool internal parts. A suitable, good-quality oil supports smoother operation and a longer engine life.",
          "Fluid levels and condition should be checked regularly, with replacements completed at the recommended intervals. These inspections can expose developing problems before they result in major repairs.",
        ],
        [
          "Protecting Your Vehicle from the Elements",
          "Weather exposure can shorten a vehicle’s life. Moisture from rain or snow encourages rust, particularly where stone chips or scratches have broken the paint surface, so damage should be inspected and protected promptly.",
          "Strong sunlight can fade paint and cause dashboard, seat and trim materials to crack. Sunshades, shaded parking, regular washing and a quality wax give the interior and exterior useful protection.",
          "Covered parking provides a barrier against harsh conditions. A garage or canopy is ideal, while a correctly fitted vehicle cover can help when permanent shelter is unavailable.",
          "These precautions limit environmental wear and help the bodywork, cabin and mechanical components remain in better condition.",
          "Making weather protection part of normal vehicle care can preserve the car’s appearance, integrity and useful life for years to come.",
        ],
      ],
    },
  };

  function normalisePath(pathname) {
    return pathname.replace(/\/+$/, "") || "/";
  }

  function iconLink(item, className = "") {
    return `<a class="social-link ${className}" href="${item.href}" target="_blank" rel="noreferrer" aria-label="${item.name}"><svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg></a>`;
  }

  function tyreLogo() {
    return '<span class="tyre-logo" aria-hidden="true"><span></span></span><span class="sr-only">Ossett Tyres home</span>';
  }

  function header(path) {
    const links = navItems
      .map(([href, label]) => {
        const current = path === href || (href === "/blog" && path.startsWith("/blog-post"));
        return `<a href="${href}"${current ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`;
      })
      .join("");
    return `
      <header class="site-header">
        <div class="header-inner">
          <a class="site-logo" href="/">${tyreLogo()}</a>
          <nav class="primary-nav" id="primary-navigation" aria-label="Primary navigation">${links}</nav>
          <div class="header-socials" aria-label="Social media">${socialLinks.map((item) => iconLink(item)).join("")}</div>
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">
            <span></span><span></span><span></span><span class="sr-only">Open navigation</span>
          </button>
        </div>
      </header>`;
  }

  function footer() {
    return `
      <footer class="site-footer">
        <div class="footer-inner">
          <div class="footer-copy">
            <h2>Services</h2>
            <p>Expert tyre repair, sales, and car servicing.</p>
            <div class="footer-socials" aria-label="Social media">
              ${socialLinks.slice(0, 2).map((item) => iconLink(item)).join("")}
              ${iconLink(
                {
                  name: "TikTok",
                  href: "https://www.tiktok.com/@ossett.tyres.auto",
                  icon: '<path d="M15.4 3c.3 2.2 1.6 3.5 3.6 3.7v3.1a8.8 8.8 0 0 1-3.6-.9v6.5a6.4 6.4 0 1 1-5.5-6.3v3.2a3.3 3.3 0 1 0 2.3 3.1V3h3.2Z"/>',
                },
              )}
            </div>
            <p class="copyright">© 2025. All rights reserved.</p>
          </div>
          <a class="call-button button button-light" href="tel:${phoneHref}">Call Us</a>
        </div>
      </footer>
      <a class="whatsapp-button" href="https://wa.me/${whatsappNumber}" target="_blank" rel="noreferrer" aria-label="Message Ossett Tyres on WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4a11.8 11.8 0 0 0-10.2 17.8L4.4 27l5.3-1.4A12 12 0 1 0 16 4Zm0 2.3a9.6 9.6 0 1 1-4.9 17.8l-.5-.3-3.1.8.8-3-.3-.5A9.6 9.6 0 0 1 16 6.3Zm-4.1 4.2c-.3 0-.7.1-1 .6-.4.5-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.9c.2.2 2.6 4.1 6.5 5.5 3.2 1.1 3.9.9 4.6.8.7-.1 2.3-1 2.7-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.9-.5l-2.7-1.3c-.4-.2-.7-.3-1 .2l-1.3 1.6c-.2.3-.5.3-.9.1a10 10 0 0 1-3-1.8 11 11 0 0 1-2-2.5c-.2-.4 0-.6.2-.8l.6-.7.4-.7c.1-.3 0-.6 0-.8l-1.2-2.8c-.3-.8-.7-.7-1-.7h-.4Z"/></svg>
      </a>`;
  }

  function cookieNotice() {
    return `
      <aside class="cookie-notice" aria-label="Cookie notice" data-cookie-notice>
        <p>This website uses cookies to provide necessary site functionality and to improve your experience. By using this website, you agree to our use of cookies.</p>
        <div class="cookie-actions">
          <button type="button" class="button button-dark button-small" data-cookie-accept>Accept</button>
          <button type="button" class="cookie-decline" data-cookie-decline>Decline</button>
        </div>
      </aside>`;
  }

  function sourceMedia(className, alt) {
    return `<div class="source-media ${className}" role="img" aria-label="${alt}"></div>`;
  }

  function pageFrame(path, main, options = {}) {
    const bodyClass = options.bodyClass || "";
    return `${header(path)}<main id="main-content" class="${bodyClass}" tabindex="-1">${main}</main>${footer()}${cookieNotice()}`;
  }

  function serviceCards({ dark = false } = {}) {
    const cards = [
      ["home-service-repair", "Reliable Tyre Repair", "Our fast and efficient tyre repair services are designed to keep you safe on the road, ensuring that you can travel with peace of mind knowing that your vehicle is in excellent condition."],
      ["home-service-sales", "Affordable Tyre Sales", "We offer a wide selection of quality tyres suitable for all types of vehicles, including cars, trucks, and SUVs, ensuring you find the perfect fit at competitive prices."],
      ["home-service-car", "Expert Car Servicing", "Comprehensive car servicing to ensure your vehicle runs smoothly and efficiently. Regular maintenance not only helps to prolong the life of your vehicle but also enhances its performance and safety on the road."],
    ];
    return `<div class="service-card-grid ${dark ? "on-dark" : ""}">${cards
      .map(
        ([imageClass, title, copy]) => `<article class="service-card">
          ${sourceMedia(imageClass, title)}
          <div class="service-card-copy"><h3>${title}</h3><p>${copy}</p></div>
        </article>`,
      )
      .join("")}</div>`;
  }

  function homePage(path) {
    const reviewCards = reviews
      .map(
        (review) => `<article class="review-card">
          <div class="review-meta"><span class="stars" aria-label="5 out of 5 stars">★★★★★</span><span>1 year ago</span><b>G</b></div>
          <p>${review.copy}</p>
          <footer><span class="review-avatar">${review.initial}</span><strong>${review.name}</strong></footer>
        </article>`,
      )
      .join("");
    const main = `
      <section class="home-hero">
        <div class="hero-shade"></div>
        <div class="hero-copy">
          <h1>Sheffield’s Go-To Garage for Tyres <br />&amp; Car Servicing</h1>
          <p>Expert tyre sales, repair services, and reliable car maintenance<br />solutions for your vehicle.</p>
          <a class="button button-dark" href="/order-your-tyres-online">Order Tyres Here</a>
        </div>
      </section>

      <section class="brands-section section-shell">
        <h2>Our Brands</h2>
        <ul class="brand-grid" aria-label="Tyre brands we stock">
          ${brands.map(([name, image]) => `<li class="brand"><img src="${image}" alt="${name} tyre logo" loading="lazy" decoding="async" /></li>`).join("")}
        </ul>
      </section>

      <section class="experts-section content-shell">
        <div class="experts-intro">
          <h2>Your Trusted Tyre <br />Experts</h2>
          <div class="experts-copy">
            <p>Providing quality tyre repair, sales, and car servicing in Sheffield. We prioritize customer satisfaction and safety with every service we offer.</p>
            <div class="rating-stat"><strong>150+</strong><span>5-Star Ratings</span></div>
          </div>
        </div>
        ${sourceMedia("home-workshop", "Blue car being serviced outside Ossett Tyres")}
      </section>

      <section class="reviews-section content-shell" aria-label="Customer reviews">
        <h2>Here is what our customers say</h2>
        <div class="review-summary">
          <span class="stars" aria-label="5 out of 5 stars">★★★★★</span><strong>5.0</strong><span>234 reviews</span>
          <a class="button button-dark button-small" href="https://www.google.com/search?q=Ossett+Tyres+Sheffield+reviews" target="_blank" rel="noreferrer">Write a review</a>
        </div>
        <div class="review-carousel">
          <button class="carousel-arrow previous" type="button" aria-label="Previous reviews" data-review-prev>‹</button>
          <div class="review-viewport"><div class="review-track" data-review-track>${reviewCards}</div></div>
          <button class="carousel-arrow next" type="button" aria-label="Next reviews" data-review-next>›</button>
        </div>
        <div class="review-dots" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><span>3 / 60</span></div>
        <button class="review-pause" type="button" data-review-pause aria-label="Pause automatic review rotation">Ⅱ</button>
        <p class="trustmary-label">Google review widget by <strong><i></i>trustmary</strong></p>
      </section>

      <section class="quality-section dark-section">
        <div class="content-shell">
          <header class="section-heading light-heading">
            <h2>Quality Tyre Services</h2>
            <p>Expert tyre repair, sales, and car servicing for your vehicle's needs in Sheffield.</p>
          </header>
          ${serviceCards({ dark: true })}
        </div>
      </section>`;
    return pageFrame(path, main, { bodyClass: "home-page" });
  }

  function servicesPage(path) {
    const topServices = [
      ["services-tyre-repair", "Tyre Repair Services", "We offer professional tyre repair services to ensure your safety and vehicle performance on the road."],
      ["services-tyre-sales", "Tyre Sales", "Explore our wide range of quality tyres for all makes and models, ensuring optimal performance."],
      ["services-car", "Car Servicing", "Our car servicing includes comprehensive checks and maintenance to keep your vehicle running smoothly."],
    ];
    const main = `
      <section class="services-intro content-shell page-top">
        <header class="section-heading">
          <h1>Tyre Services Sheffield</h1>
          <p>Expert tyre repair, sales, and car servicing for all your automotive needs in<br />Sheffield.</p>
        </header>
        <div class="services-feature-grid">${topServices
          .map(
            ([imageClass, title, copy]) => `<article class="feature-card">${sourceMedia(imageClass, title)}<h2>${title}</h2><p>${copy}</p></article>`,
          )
          .join("")}</div>
      </section>

      <section class="gallery-section content-shell">
        <header class="section-heading">
          <h2>Gallery</h2>
          <p>Here's us at work making all your journey's on the<br />road a better one!</p>
        </header>
        <div class="gallery-grid">
          ${[
            ["gallery-one", "Ossett Tyres workshop entrance and tyre stock"],
            ["gallery-two", "Technician fitting a wheel to a van"],
            ["gallery-three", "Technician repairing a van tyre"],
            ["gallery-four", "Team member arranging tyres"],
            ["gallery-five", "New tyre stock"],
            ["gallery-six", "Blue car at the Ossett Tyres workshop"],
          ]
            .map(([className, alt]) => sourceMedia(className, alt))
            .join("")}
        </div>
      </section>

      ${locationSection("services")}`;
    return pageFrame(path, main, { bodyClass: "services-page" });
  }

  function blogPage(path) {
    const cards = [
      ["/blog-post1", "blog-car", "The Most Reliable Cars for New Drivers in 2023", "", "8/28/2025 · 5 min read"],
      ["/blog-post", "blog-service", "10 Effective Ways to Increase Your Car's Longevity", "", "8/28/2025 · 4 min read"],
      [
        null,
        "blog-wheel",
        "Discover Quality Tyre Repair, Sales and Car Servicing at Ossett Tyres!",
        "At Ossett Tyres, we specialize in tyre repair, sales, and reliable car servicing. Our skilled team is dedicated to providing exceptional service and ensuring your vehicle is safe on the road. Visit us today at 9 Farfield Rd, Neepsend, Sheffield, for all your tyre needs and servicing!",
        "5/8/2024 · 1 min read",
      ],
      [
        null,
        "blog-race",
        "Essential Tyre Repair, Sale, and Car Servicing Tips for Vehicle Owners",
        "At Ossett Tyres, we specialize in tyre repair, sales, and comprehensive car servicing. Discover essential tips for maintaining your vehicle's tyres, ensuring safety on the road, and maximizing performance. Visit us at 9 Farfield Rd, Sheffield, or call +44 7380 439443 for expert assistance and quality service.",
        "5/8/2024 · 1 min read",
      ],
    ];
    const main = `<section class="blog-index content-shell page-top"><div class="blog-grid">${cards
      .map(([href, imageClass, title, excerpt, meta]) => {
        const content = `
          ${sourceMedia(imageClass, title)}
          <h2>${title}</h2>
          ${excerpt ? `<p>${excerpt}</p>` : ""}
          <span class="blog-meta">${meta}</span>`;
        return `<article class="blog-card">${href ? `<a class="blog-card-link" href="${href}">${content}</a>` : content}</article>`;
      })
      .join("")}</div></section>`;
    return pageFrame(path, main, { bodyClass: "blog-page" });
  }

  function tyreForm({ compact = false } = {}) {
    return `<section class="tyre-check ${compact ? "tyre-check-compact" : ""}" aria-labelledby="tyre-check-title">
      <h2 id="tyre-check-title">Check Tyre Availability &amp; Pricing</h2>
      <form class="tyre-form" data-tyre-form aria-describedby="tyre-data-use" novalidate>
        <label>Name<input name="name" type="text" autocomplete="name" placeholder="Full name" maxlength="80" required /></label>
        <label>Phone<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="07xxx xxxxxx" maxlength="25" required /></label>
        <div class="registration-row">
          <label>Registration<input class="registration-input" name="registration" type="text" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="AB12CDE" required /></label>
          <button class="button button-dark tyre-submit" type="submit"><span>Search</span></button>
        </div>
        <p class="form-status" aria-live="polite" data-tyre-status></p>
      </form>
      <p class="tyre-disclaimer" id="tyre-data-use">We use these details to check fitment and contact you about stock and pricing. Tyre sizes shown are third-party fitment data. Please verify on the tyre sidewall or door-jamb sticker.</p>
    </section>`;
  }

  function contactPage(path) {
    const main = `
      <section class="contact-hero content-shell page-top">
        <div class="contact-copy">
          <h1>Contact Ossett Tyres<br />Today</h1>
          <p class="contact-lead">Reach out for car repairs, general enquiries, and car servicing. We're here to help with all your vehicle needs at Ossett Tyres. Our team will get back to you within 24 hours!</p>
          <p class="contact-note"><strong>Note: For any tyre related enquries, please DO NOT fill this form. Instead use the form below this one to submit an order to us.</strong></p>
          <div class="contact-details">
            <div><h2>Contact</h2><a href="tel:${phoneHref}">${config.phone}</a></div>
            <div><h2>Inquiries</h2><a href="mailto:${config.contactEmail}">${config.contactEmail}</a></div>
          </div>
        </div>
        <form class="contact-form panel" data-contact-form novalidate>
          <h2>Get in Touch</h2>
          <label>Name<input name="name" type="text" autocomplete="name" placeholder="Enter your first name" required /></label>
          <label>Email Address<input name="email" type="email" autocomplete="email" placeholder="Enter your email address" required /></label>
          <label>Phone Number<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="07123 456789" /></label>
          <label>Message<textarea name="message" rows="5" placeholder="Type your message here" required></textarea></label>
          <button class="button button-dark" type="submit">Send Message</button>
          <p class="form-status" aria-live="polite" data-contact-status></p>
        </form>
      </section>
      <div class="content-shell contact-tyre-check">${tyreForm({ compact: true })}</div>
      ${locationSection("contact")}`;
    return pageFrame(path, main, { bodyClass: "contact-page" });
  }

  function locationSection(variant) {
    const isContact = variant === "contact";
    const mapTitle = "Interactive map showing Ossett Tyres at 9 Farfield Road, Neepsend, Sheffield";
    const mapEmbed = "https://www.google.com/maps?q=9%20Farfield%20Rd%2C%20Neepsend%2C%20Sheffield%20S3%208AB&output=embed";
    const mapLink = "https://maps.app.goo.gl/Y26tW8X6aZchRx6TA";
    return `<section class="location-section content-shell ${isContact ? "contact-location" : "services-location"}">
      <div class="location-copy">
        <h2>${isContact ? "Where are we?" : "Ossett Tyres"}</h2>
        <p>${isContact ? "9 Farfield Rd, Neepsend, Sheffield S3 8AB" : "Your trusted partner for tyre repair, sales, and car servicing in Sheffield. We ensure your vehicle runs smoothly and safely."}</p>
        ${isContact ? "" : '<h3>Location</h3><p>9 Farfield Rd, Neepsend</p>'}
        <h3>Hours</h3>
        <ul class="hours-list">
          <li><span>Monday:</span> 8:30 a.m - 6 p.m</li>
          <li><span>Tuesday:</span> 8:30 a.m - 6 p.m</li>
          <li><span>Wednesday:</span> 8:30 a.m - 6 p.m</li>
          <li><span>Thursday:</span> 8:30 a.m - 6 p.m</li>
          <li><span>Friday:</span> 8:30 a.m - 6 p.m</li>
          <li><span>Saturday:</span> 8:30 a.m - 6 p.m</li>
          <li><span>Sunday:</span> 9 a.m - 5 p.m</li>
        </ul>
      </div>
      <div class="map-frame ${isContact ? "contact-map" : "services-map"}">
        <iframe class="map-embed" src="${mapEmbed}" title="${mapTitle}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
        <a class="map-fallback" href="${mapLink}" target="_blank" rel="noreferrer">Open in Google Maps</a>
      </div>
    </section>`;
  }

  function orderPage(path) {
    const main = `<div class="order-content content-shell">${tyreForm()}</div>`;
    return pageFrame(path, main, { bodyClass: "order-page" });
  }

  function articlePage(path, article) {
    const content = article.sections
      .map(
        ([heading, ...paragraphs]) => `<section><h2>${heading}</h2>${paragraphs.map((copy) => `<p>${copy}</p>`).join("")}</section>`,
      )
      .join("");
    const main = `<article class="article-page content-shell page-top">
      <header><h1>${article.title}</h1><p class="article-meta">${article.date} ${article.read}</p></header>
      ${sourceMedia(article.imageClass, article.alt)}
      <div class="article-copy">${content}</div>
    </article>`;
    return pageFrame(path, main, { bodyClass: "article-route" });
  }

  function notFoundPage(path) {
    const main = `<section class="not-found content-shell"><p class="eyebrow">404</p><h1>That page isn't here.</h1><p>Use the navigation above or return to the Ossett Tyres home page.</p><a class="button button-dark" href="/">Back to home</a></section>`;
    return pageFrame(path, main, { bodyClass: "not-found-page" });
  }

  const routes = {
    "/": homePage,
    "/services": servicesPage,
    "/blog": blogPage,
    "/contact-us": contactPage,
    "/order-your-tyres-online": orderPage,
  };

  function setDocumentTitle(path) {
    const titles = {
      "/": "Ossett Tyres: Quality Tyre Repair and Car Servicing",
      "/services": "Tyre Services Sheffield | Ossett Tyres",
      "/blog": "Automotive Advice | Ossett Tyres Blog",
      "/contact-us": "Contact Ossett Tyres",
      "/order-your-tyres-online": "Order Your Tyres Online | Ossett Tyres",
    };
    document.title = titles[path] || (articles[path] ? `${articles[path].title} | Ossett Tyres` : "Page not found | Ossett Tyres");
  }

  function getHashTarget(hash) {
    if (!hash || hash === "#") return null;
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return null;
    }
  }

  function finishNavigation({ scroll = false, focus = false, hash = "" } = {}) {
    const main = document.querySelector("#main-content");
    const hashTarget = getHashTarget(hash);
    const focusTarget = hashTarget || main;

    if (focus && focusTarget) {
      if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
    }

    if (!scroll) return;
    if (hashTarget) {
      hashTarget.scrollIntoView({ block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  function render(pathname, { scroll = false, focus = false, hash = "" } = {}) {
    const path = normalisePath(pathname);
    const app = document.querySelector("#app");
    const page = routes[path] ? routes[path](path) : articles[path] ? articlePage(path, articles[path]) : notFoundPage(path);
    document.body.classList.remove("menu-open");
    app.innerHTML = page;
    if (Array.isArray(window.__captureKnownRoutes)) {
      document.body.classList.add("capture-full-page");
    }
    document.body.dataset.route = path.replace(/^\//, "") || "home";
    setDocumentTitle(path);
    bindPageInteractions();
    finishNavigation({ scroll, focus, hash });
  }

  function setMobileMenuOpen(open) {
    const menuButton = document.querySelector(".menu-toggle");
    const navigation = document.querySelector(".primary-nav");
    if (!menuButton || !navigation) {
      document.body.classList.remove("menu-open");
      return;
    }
    menuButton.setAttribute("aria-expanded", String(open));
    navigation.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    const label = menuButton.querySelector(".sr-only");
    if (label) label.textContent = open ? "Close navigation" : "Open navigation";
  }

  function bindPageInteractions() {
    const menuButton = document.querySelector(".menu-toggle");
    menuButton?.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") === "true";
      setMobileMenuOpen(!open);
    });

    const notice = document.querySelector("[data-cookie-notice]");
    const hasCookieChoice = Boolean(sessionStorage.getItem("ossett-cookie-choice"));
    document.body.classList.toggle("cookie-visible", Boolean(notice && !hasCookieChoice));
    if (notice && hasCookieChoice) notice.remove();
    document.querySelector("[data-cookie-accept]")?.addEventListener("click", () => dismissCookies("accepted"));
    document.querySelector("[data-cookie-decline]")?.addEventListener("click", () => dismissCookies("declined"));

    document.querySelector("[data-contact-form]")?.addEventListener("submit", submitContactForm);
    const tyreLookupForm = document.querySelector("[data-tyre-form]");
    tyreLookupForm?.addEventListener("submit", submitTyreForm);
    tyreLookupForm?.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => input.setCustomValidity(""));
    });
    document.querySelectorAll(".registration-input").forEach((input) => {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      });
    });
    bindReviews();
  }

  function dismissCookies(choice) {
    sessionStorage.setItem("ossett-cookie-choice", choice);
    document.body.classList.remove("cookie-visible");
    document.querySelector("[data-cookie-notice]")?.classList.add("is-closing");
    window.setTimeout(() => document.querySelector("[data-cookie-notice]")?.remove(), 180);
  }

  function bindReviews() {
    if (reviewTimer !== null) {
      window.clearInterval(reviewTimer);
      reviewTimer = null;
    }
    const track = document.querySelector("[data-review-track]");
    if (!track) return;
    let index = 0;
    const visibleCards = () => {
      if (window.matchMedia("(max-width: 680px)").matches) return 1;
      if (window.matchMedia("(max-width: 940px)").matches) return 2;
      return 3;
    };
    const move = (direction, wrap = false) => {
      const lastIndex = Math.max(0, reviews.length - visibleCards());
      index = wrap && lastIndex > 0
        ? (index + direction + lastIndex + 1) % (lastIndex + 1)
        : Math.max(0, Math.min(lastIndex, index + direction));
      const card = track.querySelector(".review-card");
      if (!card) return;
      const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
      track.style.transform = `translateX(-${index * (card.getBoundingClientRect().width + gap)}px)`;
    };
    document.querySelector("[data-review-prev]")?.addEventListener("click", () => move(-1));
    document.querySelector("[data-review-next]")?.addEventListener("click", () => move(1));

    const pauseButton = document.querySelector("[data-review-pause]");
    let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const updatePauseButton = () => {
      pauseButton.textContent = paused ? "▶" : "Ⅱ";
      pauseButton.setAttribute("aria-label", paused ? "Start automatic review rotation" : "Pause automatic review rotation");
    };
    const schedule = () => {
      if (paused || reviews.length <= visibleCards()) return;
      reviewTimer = window.setInterval(() => move(1, true), 5000);
    };
    pauseButton?.addEventListener("click", () => {
      paused = !paused;
      if (reviewTimer !== null) {
        window.clearInterval(reviewTimer);
        reviewTimer = null;
      }
      updatePauseButton();
      schedule();
    });
    updatePauseButton();
    schedule();
  }

  function submitContactForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-contact-status]");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = encodeURIComponent(`Website enquiry from ${data.get("name")}`);
    const body = encodeURIComponent(
      `Name: ${data.get("name")}\nEmail: ${data.get("email")}\nPhone: ${data.get("phone") || "Not supplied"}\n\n${data.get("message")}`,
    );
    status.textContent = "Your email app is opening with the completed enquiry.";
    window.location.href = `mailto:${config.contactEmail}?subject=${subject}&body=${body}`;
  }

  async function submitTyreForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-tyre-status]");
    const button = form.querySelector(".tyre-submit");
    form.querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
    if (!form.reportValidity()) return;
    status.className = "form-status";

    if (!tyreApi) {
      renderManualTyreState(status, null, "Online tyre lookup is unavailable in this build.");
      return;
    }

    let values;
    try {
      const data = new FormData(form);
      values = tyreApi.normalizeLookupInput({
        name: data.get("name"),
        phone: data.get("phone"),
        registration: data.get("registration"),
      });
    } catch (error) {
      const field = error && error.field ? form.elements.namedItem(error.field) : null;
      if (field && typeof field.setCustomValidity === "function") {
        field.setCustomValidity(error.message);
        field.reportValidity();
      } else {
        status.classList.add("is-error");
        status.textContent = error.message || "Check your details and try again.";
      }
      return;
    }

    form.elements.namedItem("name").value = values.name;
    form.elements.namedItem("phone").value = values.phone;
    form.elements.namedItem("registration").value = values.registration;

    if (!tyreClient) {
      renderManualTyreState(
        status,
        values,
        tyreConfigError
          ? "Online tyre lookup is unavailable because this build is not configured correctly."
          : "Online tyre lookup is unavailable in this build.",
      );
      return;
    }

    button.disabled = true;
    button.classList.add("is-loading");
    status.textContent = "Checking your details…";

    try {
      const result = await tyreClient.lookup(values);
      renderTyreLookupResult(status, result);
    } catch (error) {
      renderTyreLookupError(status, form, error);
      console.error("Tyre availability request failed", error);
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }

  function contactLink(type, label) {
    const link = document.createElement("a");
    link.textContent = label;
    if (type === "phone") {
      link.href = `tel:${phoneHref}`;
    }
    return link;
  }

  function renderManualTyreState(status, values, message) {
    status.className = "form-status is-manual";
    status.replaceChildren(document.createTextNode(`${message} `));
    if (values) {
      const subject = encodeURIComponent(`Tyre availability: ${values.registration}`);
      const body = encodeURIComponent(
        `Name: ${values.name}\nPhone: ${values.phone}\nRegistration: ${values.registration}\n\nPlease confirm tyre availability and pricing.`,
      );
      const email = contactLink("email", "Email your request");
      email.href = `mailto:${config.contactEmail}?subject=${subject}&body=${body}`;
      status.append(email, document.createTextNode(" or "));
    }
    const phone = contactLink("phone", `call ${config.phone}`);
    status.append(phone, document.createTextNode("."));
  }

  function renderTyreLookupResult(status, result) {
    const vehicleParts = [result.vehicle.make, result.vehicle.colour, result.vehicle.year]
      .filter((value) => value !== null && value !== "")
      .map(String);
    const heading = document.createElement("strong");
    heading.textContent = `Vehicle found${vehicleParts.length ? `: ${vehicleParts.join(" · ")}` : "."}`;
    status.className = "form-status";
    status.replaceChildren(heading);

    if (result.fitment.status === "available") {
      status.classList.add("is-success");
      status.append(
        document.createElement("br"),
        document.createTextNode(`Possible OE sizes: ${result.fitment.sizes.join(", ")}.`),
      );
    } else if (result.fitment.status === "unavailable") {
      status.append(
        document.createElement("br"),
        document.createTextNode("Vehicle details were found, but OE tyre fitment data is temporarily unavailable."),
      );
    } else {
      status.append(
        document.createElement("br"),
        document.createTextNode("Vehicle details were found, but no recognised OE tyre sizes were returned."),
      );
    }

    status.append(
      document.createElement("br"),
      document.createTextNode("Please "),
      contactLink("phone", `call ${config.phone}`),
      document.createTextNode(" to confirm live stock and pricing."),
    );
  }

  function renderTyreLookupError(status, form, error) {
    status.className = "form-status is-error";
    if (error && error.code === "INVALID_REQUEST") {
      const registration = form.elements.namedItem("registration");
      registration.setCustomValidity("Check the registration and try again.");
      registration.reportValidity();
      status.textContent = "The registration was not accepted.";
      return;
    }

    let message = "We could not check availability just now.";
    if (error && error.code === "TIMEOUT") {
      message = "The tyre lookup took too long to respond.";
    } else if (error && error.code === "RATE_LIMIT") {
      message = error.retryAfter
        ? `Too many searches were made. Please try again in about ${error.retryAfter} seconds.`
        : "Too many searches were made. Please wait before trying again.";
    } else if (error && error.code === "FORBIDDEN") {
      message = "Online lookup is not available from this website address.";
    } else if (error && ["SERVER_ERROR", "MALFORMED_RESPONSE", "API_ERROR"].includes(error.code)) {
      message = "The tyre lookup service is temporarily unavailable.";
    }

    status.replaceChildren(
      document.createTextNode(`${message} Please `),
      contactLink("phone", `call ${config.phone}`),
      document.createTextNode("."),
    );
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || link.target || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/")) return;
    const sameDocumentHash = Boolean(url.hash)
      && normalisePath(url.pathname) === normalisePath(window.location.pathname)
      && url.search === window.location.search;
    if (sameDocumentHash) return;
    event.preventDefault();
    history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    render(url.pathname, { scroll: true, focus: true, hash: url.hash });
  });

  window.addEventListener("hashchange", () => {
    const target = getHashTarget(window.location.hash);
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
  const mobileNavigationQuery = window.matchMedia("(max-width: 940px)");
  const resetNavigationAtDesktopWidth = (event) => {
    if (!event.matches) setMobileMenuOpen(false);
  };
  if (typeof mobileNavigationQuery.addEventListener === "function") {
    mobileNavigationQuery.addEventListener("change", resetNavigationAtDesktopWidth);
  } else {
    mobileNavigationQuery.addListener(resetNavigationAtDesktopWidth);
  }
  window.addEventListener("popstate", () => render(window.location.pathname, {
    scroll: true,
    focus: true,
    hash: window.location.hash,
  }));
  render(window.location.pathname, {
    scroll: Boolean(window.location.hash),
    focus: Boolean(window.location.hash),
    hash: window.location.hash,
  });
})();
