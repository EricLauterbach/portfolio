// Neutralize unload listeners to allow bfcache
(function() {
  const origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'unload') return;
    return origAdd.call(this, type, listener, options);
  };
})();



// ===============================================================
// BARBA JS INIT
// ===============================================================

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText);

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

const projectPages = [
  'copyleaks-animations',
  'copyleaks-website',
  'copyleaks-marketing',
];

let isFirstLoad = true;
let pendingHash = null;

function killSmoother() {
  if (window.smoother) {
    try { window.smoother.kill(); } catch(e) {}
    window.smoother = null;
  }
}

function initSmoother(restoreScroll = false) {
  killSmoother();
  const scrollY = restoreScroll ? (window.scrollY || window.pageYOffset) : 0;
  window.smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1,
    effects: true,
    normalizeScroll: true,
  });
  if (!pendingHash) {
    window.smoother.scrollTo(scrollY, false);
  }
  document.body.classList.remove('is-transitioning');
}

function reinitWebflow() {
  document.querySelectorAll('video[autoplay]').forEach(video => video.play());
}

// ─── Dynamic Lottie loader ────────────────────────────────────────────────
let lottieLoaded = false;

function loadLottie() {
  return new Promise((resolve) => {
    if (typeof lottie !== 'undefined') { resolve(); return; }
    if (lottieLoaded) {
      const poll = setInterval(() => {
        if (typeof lottie !== 'undefined') { clearInterval(poll); resolve(); }
      }, 50);
      return;
    }
    lottieLoaded = true;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

function initLottieElements() {
  loadLottie().then(() => {
    document.querySelectorAll('[data-animation-type="lottie"]').forEach((el) => {
      if (el._lottieInstance) {
        el._lottieInstance.destroy();
        el._lottieInstance = null;
      }

      const src = el.getAttribute('data-src');
      if (!src) return;

      const loop = el.getAttribute('data-loop') === '1';
      const renderer = el.getAttribute('data-renderer') || 'svg';
      const hoverContainer = el.closest(
        '.contentcontainerportfolioproject.copyleaksanimations.hovertriggered'
      );

      el.innerHTML = '';
      el.style.overflow = 'hidden';

      const instance = lottie.loadAnimation({
        container: el,
        renderer: renderer,
        loop: loop,
        autoplay: !hoverContainer,
        path: src,
      });

      el._lottieInstance = instance;

      if (hoverContainer && !hoverContainer._hoverBound) {
        hoverContainer._hoverBound = true;

        instance.addEventListener('DOMLoaded', () => {
          instance.goToAndStop(0, true);
        });

        hoverContainer.addEventListener('mouseenter', () => {
          const inst = el._lottieInstance;
          if (!inst) return;
          inst.setDirection(1);
          inst.play();
        });

        hoverContainer.addEventListener('mouseleave', () => {
          const inst = el._lottieInstance;
          if (!inst) return;
          inst.setDirection(-1);
          inst.play();
        });
      }
    });
  });
}

function injectPageStyles(nextDocument) {
  nextDocument.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
    const id = el.href || el.textContent.slice(0, 100);
    const alreadyExists = [...document.querySelectorAll('link[rel="stylesheet"], style')]
      .some(existing => (existing.href || existing.textContent.slice(0, 100)) === id);
    if (!alreadyExists) document.head.appendChild(el.cloneNode(true));
  });

  nextDocument.querySelectorAll('head script').forEach((el) => {
    if (el.src && el.src.includes('webflow')) return;
    const alreadyExists = el.textContent &&
      [...document.querySelectorAll('head script')]
        .some(existing => existing.textContent === el.textContent);
    if (!alreadyExists) {
      const script = document.createElement('script');
      if (el.src) script.src = el.src;
      else script.textContent = el.textContent;
      document.head.appendChild(script);
    }
  });
}

// ── Lock overflow + capture hash at earliest moment ─────────

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href') || '';

  if (href.includes('#') && !href.startsWith('#')) {
    pendingHash = '#' + href.split('#')[1];
  }

  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return;
  document.body.classList.add('is-transitioning');
});

window.addEventListener('popstate', () => {
  document.body.classList.add('is-transitioning');
});

// ── Global Barba hooks ──────────────────────────────────────

barba.hooks.before(() => {
  if (window.lockTooltip) window.lockTooltip();
  document.body.classList.add('is-transitioning');

  // Kill Lottie observers
  if (window._lottieObservers) {
    window._lottieObservers.forEach(obs => obs.disconnect());
    window._lottieObservers = [];
  }

  // Destroy all Lottie instances from previous page
  document.querySelectorAll('[data-animation-type="lottie"]').forEach(el => {
    if (el._lottieInstance) {
      el._lottieInstance.destroy();
      el._lottieInstance = null;
    }
  });
});

barba.hooks.beforeEnter((data) => {
  if (isFirstLoad) {
    isFirstLoad = false;
    return;
  }

  if (data.next.html) {
    const parser = new DOMParser();
    const nextDoc = parser.parseFromString(data.next.html, 'text/html');
    injectPageStyles(nextDoc);
  }

  gsap.set(data.next.container, { opacity: 0 });

  // Prime entrance elements before container is visible — prevents flash of natural position
  ENTRANCE_SELECTORS.forEach(selector => {
    data.next.container.querySelectorAll(selector).forEach(el => {
      gsap.set(el, { y: 100 });
    });
  });
});

barba.hooks.after((data) => {
  if (window.unlockTooltip) window.unlockTooltip();
  initSmoother(true);
  reinitWebflow();
  initAll();

  const namespace = data.next.namespace;
  if (namespace === 'home') initHomePage();
  if (namespace === 'copyleaks-animations') {
    setTimeout(() => {
      ScrollTrigger.refresh();
      initLottieElements();
      initCopyleaksAnimations();
    }, 300);
  }
  if (namespace === 'copyleaks-marketing') {
    setTimeout(() => {
      initCopyleaksMarketing();
    }, 300);
  }
  if (namespace === 'copyleaks-website') {
    setTimeout(() => {
      initCopyleaksWebsite();
    }, 300);
  }

  // Entrance animations — every page, always last
  setTimeout(() => {
    ScrollTrigger.refresh();
    initEntranceAnimations();
  }, 500);

  if (pendingHash) {
    const hash = pendingHash;
    pendingHash = null;
    history.replaceState(null, '', hash);
    setTimeout(() => {
      const target = document.querySelector(hash);
      if (target) {
        if (window.smoother) window.smoother.scrollTo(target, true);
        else target.scrollIntoView({ behavior: 'smooth' });
      }
    }, 200);
  }
});

// ── Transitions ─────────────────────────────────────────────

const TRANSITION_Y = 30;

barba.init({
  preventRunning: true,
  sync: true,
  prevent: ({ el }) => {
    const href = el.getAttribute('href') || '';
    return href.startsWith('#');
  },

  transitions: [
    // ─── Home → Project Page ───────────────────────────────
    {
      name: 'home-to-project',
      from: { namespace: ['home'] },
      to:   { namespace: projectPages },
    
      async leave(data) {
        const scrollY = window.smoother ? window.smoother.scrollTop() : (window.scrollY || window.pageYOffset);
        killSmoother();
        gsap.set(data.current.container, {
          position: 'fixed',
          top: -scrollY,
          left: 0,
          width: '100%',
          zIndex: 1
        });
    
        gsap.to('.backbuttoncontainerportfolio', {
          y: 0, opacity: 1, duration: 0.6, ease: 'elastic.out(1,1)'
        });
        gsap.to('.profiletextitemportfolio.name', {
          y: -60, opacity: 0, duration: 0.6, ease: 'elastic.out(1,1)'
        });
        gsap.to('#profileTextContainer', {
          width: $('.backbuttoncontainerportfolio').outerWidth(),
          duration: 0.6, ease: 'elastic.out(1,1)'
        });
    
        gsap.to('#navSecondaryUnderline', {
          opacity: 0, duration: 0.4
        });
    
        await gsap.to(data.current.container, {
          opacity: 0,
          top: `-=${TRANSITION_Y}`,
          duration: 0.6,
          ease: "power2.inOut",
        });
      },
    
      async enter(data) {
        gsap.set('#navSecondaryUnderline', { clipPath: 'inset(0 100% 0 0)' });
        gsap.set(data.next.container, { opacity: 0, y: TRANSITION_Y, zIndex: 2 });
        await gsap.to(data.next.container, {
          opacity: 1, y: 0, duration: 0.6, ease: "power2.inOut", clearProps: 'all'
        });
      }
    },
    
    // ─── Project Page → Home ───────────────────────────────
    {
      name: 'project-to-home',
      from: { namespace: projectPages },
      to:   { namespace: ['home'] },
    
      async leave(data) {
        if (window.forceCloseMobileContactMenu) window.forceCloseMobileContactMenu();
    
        const scrollY = window.smoother ? window.smoother.scrollTop() : (window.scrollY || window.pageYOffset);
        killSmoother();
        gsap.set(data.current.container, {
          position: 'fixed',
          top: -scrollY,
          left: 0,
          width: '100%',
          zIndex: 1
        });
    
        gsap.to('.backbuttoncontainerportfolio', {
          y: 60, opacity: 0, duration: 0.6, ease: 'elastic.out(1,1)'
        });
        gsap.to('.profiletextitemportfolio.name', {
          y: 0, opacity: 1, duration: 0.6, ease: 'elastic.out(1,1)'
        });
        gsap.to('#profileTextContainer', {
          width: $('#profileTextName').outerWidth(),
          duration: 0.6, ease: 'elastic.out(1,1)'
        });
    
        await gsap.to(data.current.container, {
          opacity: 0,
          top: `-=${TRANSITION_Y}`,
          duration: 0.6,
          ease: "power2.inOut",
        });
      },
    
      async enter(data) {
        gsap.set('#navSecondaryUnderline', { clipPath: 'inset(0 0% 0 0)' });
        gsap.set(data.next.container, { opacity: 0, y: TRANSITION_Y, zIndex: 2 });
        await gsap.to(data.next.container, {
          opacity: 1, y: 0, duration: 0.6, ease: "power2.inOut", clearProps: 'all'
        });
      }
    }
  ]
});




// ================================
// SCROLL ENTRANCE ANIMATIONS
// Add selectors here to apply entrance animation to any element
// ================================

const ENTRANCE_SELECTORS = [
  '.contentcontainerportfolioproject.copyleaksanimations',
  '.bentoitemportfoliohome',
  '.projectportfoliohome',
  '.contactbuttonportfolio',
  '.contentcontainerportfolioproject',
];

function initEntranceAnimations() {
  if (!ENTRANCE_SELECTORS.length) return;

  const Y_OFFSET = 100;
  const DURATION = 1.5;
  const STAGGER_OFFSET = 0.15;
  const IN_VIEW_DELAY = 0.3;

  const elements = [];
  ENTRANCE_SELECTORS.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (!elements.includes(el)) elements.push(el);
    });
  });

  if (!elements.length) return;

  let entranceTriggers = [];

  function buildTriggers() {
    entranceTriggers.forEach(st => st.kill());
    entranceTriggers = [];

    const sorted = [...elements].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    // Row grouping for stagger
    const rows = {};
    sorted.forEach(el => {
      if (el._entranceComplete) return;
      const top = Math.round(window.smoother.offset(el, 'top') / 10) * 10;
      if (!rows[top]) rows[top] = [];
      rows[top].push(el);
    });

    // Separate elements into already-in-view vs below fold
    const scrollY = window.smoother ? window.smoother.scrollTop() : window.scrollY;
    const viewportBottom = scrollY + window.innerHeight;

    const inViewElements = [];
    const belowFoldElements = [];

    sorted.forEach(el => {
      if (el._entranceComplete) return;
      const elTop = window.smoother.offset(el, 'top');
      if (elTop <= viewportBottom) {
        inViewElements.push(el);
      } else {
        belowFoldElements.push(el);
      }
    });

    // Animate in-view elements directly — no ScrollTrigger, just a clean staggered delay
    inViewElements.forEach((el) => {
      const top = Math.round(window.smoother.offset(el, 'top') / 10) * 10;
      const row = rows[top];
      const indexInRow = row ? row.indexOf(el) : 0;
      const staggerDelay = (row && row.length > 1) ? indexInRow * STAGGER_OFFSET : 0;

      el._entranceComplete = true;
      gsap.to(el, {
        y: 0,
        duration: DURATION,
        delay: IN_VIEW_DELAY + staggerDelay,
        ease: 'elastic.out(1,1)',
        overwrite: false,
      });
    });

    // Below-fold elements use ScrollTrigger as normal
    belowFoldElements.forEach(el => {
      const top = Math.round(window.smoother.offset(el, 'top') / 10) * 10;
      const row = rows[top];
      const indexInRow = row ? row.indexOf(el) : 0;
      const staggerDelay = (row && row.length > 1) ? indexInRow * STAGGER_OFFSET : 0;

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        invalidateOnRefresh: true,
        onEnter: () => {
          el._entranceComplete = true;
          gsap.to(el, {
            y: 0,
            duration: DURATION,
            delay: staggerDelay,
            ease: 'elastic.out(1,1)',
            overwrite: false,
          });
        },
      });

      entranceTriggers.push(st);
    });
  }

  buildTriggers();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildTriggers();
      ScrollTrigger.refresh();
    }, 250);
  });
}


// ============================================================
// GLOBAL INIT — runs on load + after every Barba transition
// ============================================================

function initAll() {

  ScrollTrigger.getAll().forEach(st => st.kill());

  // UPDATE NAVIGATION URLS BASED ON PAGE
  (function() {
    const namespace = document.querySelector('[data-barba="container"]')?.dataset?.barbaNamespace;
    const isHome = namespace === 'home';

    document.querySelectorAll('a[href="#workPortfolioHome"], a[href="/#workPortfolioHome"]').forEach(el => {
      el.setAttribute('href', isHome ? '#workPortfolioHome' : '/#workPortfolioHome');
    });

    document.querySelectorAll('a[href="#aboutPortfolioHome"], a[href="/#aboutPortfolioHome"]').forEach(el => {
      el.setAttribute('href', isHome ? '#aboutPortfolioHome' : '/#aboutPortfolioHome');
    });
  })();


  // CONTACT BUTTON TOGGLE LOGIC
  (function() {
    var contactButton = $("#contactButtonNav");
    var navLinks = $(".navlinksportfolio");
    var navContactLinks = $(".navcontactlinksportfolio");
    var navRight = $(".navrightportfolio");
    var navContactItems = navContactLinks.find(".navcontactlinksitemportfolio");
    var closeText = $(".contactbuttonclosenavportfolio");
    var contactContent = $(".contactbuttoncontentportfolio");
    var isActive = false;
    var initialPaddingBottom;

    function initContactButton() {
      var navLinksHeight = navLinks.outerHeight();
      var navContactLinksHeight = navContactLinks.outerHeight();
      initialPaddingBottom = parseFloat(navRight.css("padding-bottom")) || 0;
      gsap.set(navContactLinks, { y: navLinksHeight + 10, opacity: 0 });
      gsap.set(navContactItems, { y: 50 });
      gsap.set(closeText, { y: 30, opacity: 0 });
      gsap.set(contactContent, { y: 0, opacity: 1 });

      function activateMenu() {
        gsap.to(navRight, { paddingBottom: navContactLinksHeight + 10, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navContactLinks, { opacity: 1, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navContactItems, {
          y: 0, ease: "power2.inOut", stagger: 0.1,
          duration: function(index) {
            if (index === 0) return 0.6;
            if (index === 1) return 0.5;
            return 0.4;
          }
        });
        gsap.to(closeText, { y: 0, opacity: 1, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(contactContent, { y: -30, opacity: 0, duration: 0.6, ease: "elastic.out(1,1)" });
        isActive = true;
      }

      function deactivateMenu() {
        if (!isActive) return;
        gsap.killTweensOf([navRight, navContactLinks, navContactItems, closeText, contactContent]);
        gsap.to(navRight, { paddingBottom: initialPaddingBottom, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navContactLinks, { opacity: 0, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navContactItems, { y: 50, duration: 0.6, ease: "power2.inOut", stagger: 0 });
        gsap.to(closeText, { y: 30, opacity: 0, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(contactContent, { y: 0, opacity: 1, duration: 0.6, ease: "elastic.out(1,1)" });
        isActive = false;
      }

      window.forceCloseContactMenu = deactivateMenu;
      contactButton.off("click.contactToggle").on("click.contactToggle", function() {
        if (!isActive) activateMenu(); else deactivateMenu();
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initContactButton);
    } else {
      initContactButton();
    }
  })();


  // CLOSE CONTACT MENU ON OUTSIDE CLICK
  $(document).off("click.outsideContact").on("click.outsideContact", function(e) {
    if (!$(e.target).closest(".navrightportfolio").length) {
      if (window.forceCloseContactMenu) window.forceCloseContactMenu();
    }
  });


  // SECONDARY NAV UNDERLINE SCROLL
  (function() {
    if (!document.querySelector("#workPortfolioHome") || !document.querySelector("#aboutPortfolioHome")) return;

    function initSecondaryNav() {
      var navSecondary = $("#navSecondary");
      var underline = $("#navSecondaryUnderline");
      var workLink = navSecondary.find("a").eq(0);
      var aboutLink = navSecondary.find("a").eq(1);

      function getInternalWidth($el) {
        var totalWidth = $el.outerWidth();
        var paddingLeft = parseFloat($el.css("padding-left")) || 0;
        var paddingRight = parseFloat($el.css("padding-right")) || 0;
        return totalWidth - paddingLeft - paddingRight;
      }

      var workButtonTextWidth = getInternalWidth(workLink);
      var aboutButtonTextWidth = getInternalWidth(aboutLink);
      var buttonSpacing = 30;

      gsap.set(underline, { clipPath: 'inset(0 0% 0 0)', width: 0, x: workButtonTextWidth * 0.5, y: 4, opacity: 0 });

      ScrollTrigger.create({
        trigger: "#workPortfolioHome",
        start: "top 35%", end: "bottom 35%",
        invalidateOnRefresh: true,
        onEnter: activateWork, onEnterBack: activateWork,
        onLeave: deactivateBottom, onLeaveBack: deactivateTop
      });

      function activateWork() {
        gsap.to(underline, { width: workButtonTextWidth, x: 0, y: 0, opacity: 1, duration: 0.6, ease: "elastic.out(1,1)" });
      }

      ScrollTrigger.create({
        trigger: "#aboutPortfolioHome",
        start: "top 35%", end: "bottom 35%",
        invalidateOnRefresh: true,
        onEnter: activateAbout, onEnterBack: activateAbout
      });

      function activateAbout() {
        gsap.to(underline, {
          width: aboutButtonTextWidth,
          x: workButtonTextWidth + buttonSpacing,
          y: 0, opacity: 1, duration: 0.6, ease: "elastic.out(1,1)"
        });
      }

      ScrollTrigger.create({
        trigger: "#aboutPortfolioHome",
        start: "bottom 35%",
        invalidateOnRefresh: true,
        onEnter: deactivateBottom, onEnterBack: deactivateBottom
      });

      function deactivateBottom() {
        gsap.to(underline, {
          width: 0,
          x: workButtonTextWidth + buttonSpacing + aboutButtonTextWidth * 0.5,
          y: 4, opacity: 0, duration: 0.6, ease: "power2.inOut"
        });
      }

      function deactivateTop() {
        gsap.to(underline, { width: 0, x: workButtonTextWidth * 0.5, y: 4, opacity: 0, duration: 0.6, ease: "power2.inOut" });
      }

      ScrollTrigger.refresh();
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initSecondaryNav);
    } else {
      initSecondaryNav();
    }
  })();


  // NAV MINIMIZE / HOVER LOGIC
  (function() {
    function initNavMinimizeLogic() {
      var profileTextContainer = $("#profileTextContainer");
      var contactButtonTextNav = $("#contactButtonTextNav");
      var contactButtonNav     = $("#contactButtonNav");
      var navLeft              = $(".navleftportfolio");
      var navRight             = $(".navrightportfolio");
      var lastMouseX           = window.innerWidth / 2;
      var lastMouseY           = 0;
      var hasScrolledPastTrigger = false;
      var minimizedPadding = { top: 10, right: 15, bottom: 10, left: 15 };
      var expandedPadding  = { top: 0, right: 0, bottom: 0, left: 0 };
      var profileCollapsedWidth = 0, buttonTextCollapsedWidth = 0;
      var leftProgress = 1, rightProgress = 1;
      var profileMarginRight, profileOpacity, buttonMarginRight, buttonOpacity;
      var buttonPadTop, buttonPadRight, buttonPadBottom, buttonPadLeft;

      function setupSetters() {
        profileMarginRight = gsap.quickTo(profileTextContainer[0], "marginRight", { duration: 0.55, ease: "power3.out" });
        profileOpacity     = gsap.quickTo(profileTextContainer[0], "opacity",     { duration: 0.55, ease: "power3.out" });
        buttonMarginRight  = gsap.quickTo(contactButtonTextNav[0], "marginRight", { duration: 0.55, ease: "power3.out" });
        buttonOpacity      = gsap.quickTo(contactButtonTextNav[0], "opacity",     { duration: 0.55, ease: "power3.out" });
        buttonPadTop       = gsap.quickTo(contactButtonNav[0], "paddingTop",    { duration: 0.55, ease: "power3.out" });
        buttonPadRight     = gsap.quickTo(contactButtonNav[0], "paddingRight",  { duration: 0.55, ease: "power3.out" });
        buttonPadBottom    = gsap.quickTo(contactButtonNav[0], "paddingBottom", { duration: 0.55, ease: "power3.out" });
        buttonPadLeft      = gsap.quickTo(contactButtonNav[0], "paddingLeft",   { duration: 0.55, ease: "power3.out" });
      }

      function captureDesktopValues() {
        expandedPadding.top    = parseFloat(contactButtonNav.css("padding-top"))    || 0;
        expandedPadding.right  = parseFloat(contactButtonNav.css("padding-right"))  || 0;
        expandedPadding.bottom = parseFloat(contactButtonNav.css("padding-bottom")) || 0;
        expandedPadding.left   = parseFloat(contactButtonNav.css("padding-left"))   || 0;
        profileCollapsedWidth    = profileTextContainer.outerWidth();
        buttonTextCollapsedWidth = contactButtonTextNav.outerWidth();
      }

      function captureCollapsedWidths() {
        profileCollapsedWidth    = profileTextContainer.outerWidth();
        buttonTextCollapsedWidth = contactButtonTextNav.outerWidth();
      }

      function applyLeftProgress(p) {
        profileMarginRight(-(profileCollapsedWidth) * (1 - p));
        profileOpacity(p);
      }

      function applyRightProgress(p) {
        buttonMarginRight(-(buttonTextCollapsedWidth) * (1 - p));
        buttonOpacity(p);
        buttonPadTop(   gsap.utils.interpolate(minimizedPadding.top,    expandedPadding.top,    p));
        buttonPadRight( gsap.utils.interpolate(minimizedPadding.right,  expandedPadding.right,  p));
        buttonPadBottom(gsap.utils.interpolate(minimizedPadding.bottom, expandedPadding.bottom, p));
        buttonPadLeft(  gsap.utils.interpolate(minimizedPadding.left,   expandedPadding.left,   p));
      }

      var PROXIMITY_MAX_DIST = 180;

      function getProximityRatio(mouseX, mouseY, $el) {
        if (!$el.length) return 0;
        var rect = $el[0].getBoundingClientRect();
        if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) return 1;
        var nearestX = Math.max(rect.left, Math.min(mouseX, rect.right));
        var nearestY = Math.max(rect.top,  Math.min(mouseY, rect.bottom));
        var dist = Math.sqrt(Math.pow(mouseX - nearestX, 2) + Math.pow(mouseY - nearestY, 2));
        return gsap.utils.clamp(0, 1, Math.pow(1 - Math.min(dist / PROXIMITY_MAX_DIST, 1), 2));
      }

      function forceExpand() {
        leftProgress = 1; rightProgress = 1;
        applyLeftProgress(1); applyRightProgress(1);
      }

      function evaluateFromMouse() {
        var newLeft  = getProximityRatio(lastMouseX, lastMouseY, navLeft);
        var newRight = getProximityRatio(lastMouseX, lastMouseY, navRight);
        if (newRight < 0.5 && rightProgress >= 0.5) {
          if (window.forceCloseContactMenu) window.forceCloseContactMenu();
        }
        leftProgress = newLeft; rightProgress = newRight;
        applyLeftProgress(leftProgress); applyRightProgress(rightProgress);
      }

      function runDesktopInit() {
        captureDesktopValues();
        setupSetters();
        if (!hasScrolledPastTrigger) forceExpand(); else evaluateFromMouse();
      }

      if (navRight.is(":visible")) runDesktopInit();

      ScrollTrigger.create({
        trigger: document.body,
        start: "top+=250 top",
        invalidateOnRefresh: true,
        onEnter: function() {
          hasScrolledPastTrigger = true;
          captureCollapsedWidths();
          if (window.forceCloseContactMenu) window.forceCloseContactMenu();
          evaluateFromMouse();
        },
        onLeaveBack: function() {
          hasScrolledPastTrigger = false;
          forceExpand();
        }
      });

      $(document).off("mousemove.navMinimize").on("mousemove.navMinimize", function(e) {
        lastMouseX = e.clientX; lastMouseY = e.clientY;
        if (!hasScrolledPastTrigger) return;
        evaluateFromMouse();
      });

      ScrollTrigger.refresh();
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initNavMinimizeLogic);
    } else {
      initNavMinimizeLogic();
    }
  })();


  // SET PROFILE TEXT CONTAINER WIDTH
  (function() {
    function setProfileContainerWidth() {
      const namespace = document.querySelector('[data-barba="container"]')?.dataset?.barbaNamespace;
      const nameWidth = $("#profileTextName").outerWidth();
      const backButtonWidth = $(".backbuttoncontainerportfolio").outerWidth();

      if (namespace === 'home') {
        $("#profileTextContainer").css("width", nameWidth + "px");
      } else {
        $("#profileTextContainer").css("width", backButtonWidth + "px");
      }
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setProfileContainerWidth);
    } else {
      setProfileContainerWidth();
    }
  })();

  // BACK BUTTON + PROFILE NAME INITIAL STATES
  (function() {
    const namespace = document.querySelector('[data-barba="container"]')?.dataset?.barbaNamespace;

    if (namespace === 'home') {
      gsap.set('.backbuttoncontainerportfolio', { y: 60, opacity: 0 });
      gsap.set('.profiletextitemportfolio.name', { y: 0, opacity: 1 });
      gsap.set('#profileTextContainer', { width: $('#profileTextName').outerWidth() });
    } else {
      gsap.set('.backbuttoncontainerportfolio', { y: 0, opacity: 1 });
      gsap.set('.profiletextitemportfolio.name', { y: -60, opacity: 0 });
      gsap.set('#profileTextContainer', { width: $('.backbuttoncontainerportfolio').outerWidth() });
    }
  })();


  // NAV CONTACT LINK BUTTONS HOVER
  document.querySelectorAll(".navcontactlinksitemportfolio").forEach((button) => {
    const buttonImage = button.querySelector(".navcontactlinkimage");
    button.addEventListener("mouseenter", () => {
      gsap.killTweensOf(buttonImage, "scale");
      gsap.to(buttonImage, { scale: 1.2, duration: 0.6, ease: "elastic.out(1,1)" });
    });
    button.addEventListener("mouseleave", () => {
      gsap.killTweensOf(buttonImage, "scale");
      gsap.to(buttonImage, { scale: 1, duration: 0.6, ease: "elastic.out(1,1)" });
    });
  });


  // MOBILE NAV CONTACT BUTTON TOGGLE
  (function() {
    var menuButton      = $(".menubuttonportfoliomobile");
    var navTop          = $(".navtopportfoliomobile");
    var navBottom       = $(".navbottomportfoliomobile");
    var navContainer    = $(".navcontainerportfoliomobile");
    var navContactItems = navBottom.find(".navcontactlinksitemportfoliomobile");
    var closeText       = $(".contactbuttonclosenavportfoliomobile");
    var contactContent  = $(".contactbuttoncontentportfoliomobile");
    var isActiveMobile  = false;
    var navBottomHeight;
    var initialPaddingBottom = parseFloat(navContainer.css("padding-bottom")) || 0;

    function captureMobileHeights() { navBottomHeight = navBottom.outerHeight(); }
    function getNavTopHeight() { return navTop.outerHeight(); }

    function initMobileContactButton() {
      captureMobileHeights();
      gsap.set(navBottom,       { y: getNavTopHeight(), opacity: 0 });
      gsap.set(navContactItems, { y: 50 });
      gsap.set(closeText,       { y: 30, opacity: 0 });
      gsap.set(contactContent,  { y: 0, opacity: 1 });

      function activateMenu() {
        captureMobileHeights();
        gsap.to(navContainer,    { paddingBottom: initialPaddingBottom + navBottomHeight, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navBottom,       { opacity: 1, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navContactItems, {
          y: 0, ease: "power2.inOut", stagger: 0.1,
          duration: function(index) {
            if (index === 0) return 0.6;
            if (index === 1) return 0.5;
            return 0.4;
          }
        });
        gsap.to(closeText,      { y: 0, opacity: 1, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(contactContent, { y: -30, opacity: 0, duration: 0.6, ease: "elastic.out(1,1)" });
        isActiveMobile = true;
      }

      function deactivateMenu() {
        if (!isActiveMobile) return;
        gsap.killTweensOf([navContainer, navBottom, navContactItems, closeText, contactContent]);
        gsap.to(navContainer,    { paddingBottom: initialPaddingBottom, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navBottom,       { opacity: 0, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(navContactItems, { y: 50, duration: 0.6, ease: "power2.inOut", stagger: 0 });
        gsap.to(closeText,       { y: 30, opacity: 0, duration: 0.6, ease: "elastic.out(1,1)" });
        gsap.to(contactContent,  { y: 0, opacity: 1, duration: 0.6, ease: "elastic.out(1,1)" });
        isActiveMobile = false;
      }

      window.forceCloseMobileContactMenu = deactivateMenu;

      menuButton.off("click.mobileToggle").on("click.mobileToggle", function() {
        if (!isActiveMobile) activateMenu(); else deactivateMenu();
      });

      $(window).off("resize.mobileNav").on("resize.mobileNav", function() {
        captureMobileHeights();
        if (isActiveMobile) gsap.set(navContainer, { paddingBottom: initialPaddingBottom + navBottomHeight + 10 });
        else gsap.set(navBottom, { y: getNavTopHeight() });
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initMobileContactButton);
    } else {
      initMobileContactButton();
    }
  })();


  // CLOSE MOBILE MENU ON OUTSIDE CLICK
  $(document).off("click.outsideMobile").on("click.outsideMobile", function(e) {
    if (!$(e.target).closest(".navcontainerportfoliomobile").length) {
      if (window.forceCloseMobileContactMenu) window.forceCloseMobileContactMenu();
    }
  });


  // CLOSE MOBILE MENU ON IN-PAGE NAV CLICK
  $(document).off("click.mobileInPageNav").on("click.mobileInPageNav", '[data-wf--button-secondary--variant="secondary"].buttonportfolio', function() {
    if (window.forceCloseMobileContactMenu) window.forceCloseMobileContactMenu();
  });


  // MOBILE NAV CONTACT LINK BUTTONS HOVER
  document.querySelectorAll(".navcontactlinksitemportfoliomobile").forEach((button) => {
    const buttonImageMobile = button.querySelector(".navcontactlinkimageportfoliomobile");
    button.addEventListener("mouseenter", () => {
      gsap.killTweensOf(buttonImageMobile, "scale");
      gsap.to(buttonImageMobile, { scale: 1.2, duration: 0.6, ease: "elastic.out(1,1)" });
    });
    button.addEventListener("mouseleave", () => {
      gsap.killTweensOf(buttonImageMobile, "scale");
      gsap.to(buttonImageMobile, { scale: 1, duration: 0.6, ease: "elastic.out(1,1)" });
    });
  });


  // CONTACT BUTTONS HOVER
  document.querySelectorAll(".contactbuttonportfolio").forEach((button) => {
    const buttonImage = button.querySelector(".contactbuttonimageportfolio");
    button.addEventListener("mouseenter", () => {
      gsap.getTweensOf(button).forEach(t => { if (t.vars.scale !== undefined) t.kill(); });
      gsap.getTweensOf(buttonImage).forEach(t => { if (t.vars.scale !== undefined) t.kill(); });
      gsap.to(button,      { scale: 1.15, duration: 0.6, ease: "elastic.out(1,1)", overwrite: false });
      gsap.to(buttonImage, { scale: 1.1,  duration: 0.6, ease: "elastic.out(1,1)", overwrite: false });
    });
    button.addEventListener("mouseleave", () => {
      gsap.getTweensOf(button).forEach(t => { if (t.vars.scale !== undefined) t.kill(); });
      gsap.getTweensOf(buttonImage).forEach(t => { if (t.vars.scale !== undefined) t.kill(); });
      gsap.to(button,      { scale: 1, duration: 0.6, ease: "elastic.out(1,1)", overwrite: false });
      gsap.to(buttonImage, { scale: 1, duration: 0.6, ease: "elastic.out(1,1)", overwrite: false });
    });
  });


  // TINY BUTTONS HOVER
  document.querySelectorAll('.tinybuttonportfolio').forEach(button => {
    const circle = button.querySelector('.tinybuttoncontainerportfolio');
    const tag    = button.querySelector('.tagportfolio');
    if (!circle || !tag) return;
    const initialWidth  = button.offsetWidth;
    const expandedWidth = initialWidth + tag.offsetWidth + 20;
    circle.addEventListener('mouseenter', () => {
      gsap.killTweensOf([button, tag]);
      gsap.to(button, { width: expandedWidth, duration: 1, ease: "elastic.out(1,1)" });
      gsap.to(tag,    { opacity: 1, duration: 0.3, delay: 0.15, ease: 'power2.out' });
    });
    button.addEventListener('mouseleave', () => {
      gsap.killTweensOf([button, tag]);
      gsap.to(tag,    { opacity: 0, duration: 0.3, ease: 'power2.out' });
      gsap.to(button, { width: initialWidth, delay: 0.1, duration: 0.5, ease: 'power2.out' });
    });
  });

} // ← END OF initAll()


// ============================================================
// HOME PAGE SPECIFIC JS
// ============================================================

function initHomePage() {

  // ── Projects hover ──────────────────────────────────────
  const projectItems = document.querySelectorAll(".projectportfoliohome");
  projectItems.forEach((item) => {
    const smallButton      = item.querySelector(".smallbuttonportfolio");
    const imageContainer   = item.querySelector(".projectimagecontainerportfoliohome");
    const smallButtonIcon  = item.querySelector(".smallbuttoniconportfolio");
    let isHovered = false;
    let initialPadding = null;
    const spacingTiny = getComputedStyle(document.documentElement)
      .getPropertyValue("--_portfolio-spacing---spacing-tiny").trim();

    function runIconLoop() {
      if (!isHovered) {
        gsap.to(smallButtonIcon, { x: 0, duration: 0.6, ease: "elastic.out(1.5,1)" });
        return;
      }
      gsap.to(smallButtonIcon, {
        x: 26, duration: 1, ease: "power2.inOut",
        onComplete: () => {
          gsap.set(smallButtonIcon, { x: -26 });
          runIconLoop();
        }
      });
    }

    item.addEventListener("mouseenter", () => {
      initialPadding = getComputedStyle(imageContainer).padding;
      isHovered = true;
      gsap.killTweensOf(smallButton);
      gsap.killTweensOf(imageContainer);
      if (gsap.isTweening(smallButtonIcon)) {
        gsap.getTweensOf(smallButtonIcon).forEach(tween => {
          tween.eventCallback("onComplete", () => { if (isHovered) runIconLoop(); });
        });
      } else {
        gsap.set(smallButtonIcon, { x: 0 });
        runIconLoop();
      }
      gsap.to(imageContainer, { padding: spacingTiny, duration: 0.4, ease: "power2.inOut" });
      projectItems.forEach((otherItem) => {
        if (otherItem !== item) {
          gsap.getTweensOf(otherItem).forEach(t => { if (t.vars.opacity !== undefined) t.kill(); });
          gsap.to(otherItem, { opacity: 0.1, duration: 0.4, ease: "power2.inOut", overwrite: false });
        }
      });
    });

    item.addEventListener("mouseleave", () => {
      isHovered = false;
      gsap.killTweensOf(smallButton);
      gsap.killTweensOf(imageContainer);
      gsap.to(imageContainer, { padding: initialPadding, duration: 0.4, ease: "power2.inOut" });
      projectItems.forEach((otherItem) => {
        if (otherItem !== item) {
          gsap.getTweensOf(otherItem).forEach(t => { if (t.vars.opacity !== undefined) t.kill(); });
          gsap.to(otherItem, { opacity: 1, duration: 0.4, ease: "power2.inOut", overwrite: false });
        }
      });
    });
  });

  // ── Techstack slider + hover ─────────────────────────────
  const sliderWrapper    = document.getElementById("sliderWrapper");
  const sliderBtnDesign  = document.getElementById("sliderButtonDesign");
  const sliderBtnDev     = document.getElementById("sliderButtonDev");
  const sliderBackground = document.getElementById("sliderButtonBackground");
  const techstackSlider1 = document.getElementById("techstackSlider1");
  const techstackSlider2 = document.getElementById("techstackSlider2");

  if (sliderWrapper && sliderBtnDesign && sliderBtnDev && sliderBackground && techstackSlider1 && techstackSlider2) {
    let activeState = "design";

    function calculateValues() {
      const activeButton = activeState === "design" ? sliderBtnDesign : sliderBtnDev;
      const wrapperRect  = sliderWrapper.getBoundingClientRect();
      const buttonRect   = activeButton.getBoundingClientRect();
      const bgStyles     = window.getComputedStyle(sliderBackground);
      const bgBorderX    = parseFloat(bgStyles.borderLeftWidth) + parseFloat(bgStyles.borderRightWidth);
      const bgBorderY    = parseFloat(bgStyles.borderTopWidth)  + parseFloat(bgStyles.borderBottomWidth);
      const sliderHeight = techstackSlider1.getBoundingClientRect().height;
      return {
        bgX: buttonRect.left - wrapperRect.left,
        bgY: buttonRect.top  - wrapperRect.top,
        bgWidth:  buttonRect.width  - bgBorderX,
        bgHeight: buttonRect.height - bgBorderY,
        techstackY: activeState === "design" ? 0 : -sliderHeight
      };
    }

    function updateUI(animate = false) {
      const values = calculateValues();
      if (animate) {
        gsap.to(sliderBackground, { duration: 0.6, ease: "elastic.out(1,1)", x: values.bgX, y: values.bgY, width: values.bgWidth, height: values.bgHeight });
        gsap.to([techstackSlider1, techstackSlider2], { duration: 0.6, ease: "elastic.out(1,1)", y: values.techstackY });
      } else {
        gsap.set(sliderBackground, { x: values.bgX, y: values.bgY, width: values.bgWidth, height: values.bgHeight });
        gsap.set([techstackSlider1, techstackSlider2], { y: values.techstackY });
      }
    }

    sliderBtnDesign.addEventListener("click", function() { if (activeState !== "design") { activeState = "design"; updateUI(true); } });
    sliderBtnDev.addEventListener("click",    function() { if (activeState !== "dev")    { activeState = "dev";    updateUI(true); } });
    window.addEventListener("resize",   function() { updateUI(false); });
    updateUI(false);

    if (window.techstackCarouselDesign) { window.techstackCarouselDesign.destroy(); }
    if (window.techstackCarouselDev)    { window.techstackCarouselDev.destroy(); }

    window.techstackCarouselDesign = new Splide('#techstackSlider1', {
      type: 'loop', drag: 'free', focus: '1', arrows: false, pagination: false,
      autoWidth: true, autoplay: true, snap: true, perMove: 1,
      speed: 3000, interval: 5000, padding: { left: 29 },
      easing: 'cubic-bezier(.09,1.88,.5,.92)',
    });
    window.techstackCarouselDev = new Splide('#techstackSlider2', {
      type: 'loop', drag: 'free', focus: '1', arrows: false, pagination: false,
      autoWidth: true, autoplay: true, snap: true, perMove: 1,
      speed: 3000, interval: 5000, padding: { left: 29 },
      easing: 'cubic-bezier(.09,1.88,.5,.92)',
    });
    window.techstackCarouselDesign.mount();
    window.techstackCarouselDev.mount();

    // Techstack hover — Design
    const itemsDesign = document.querySelectorAll(".techstackslidedesignportfoliohome");
    gsap.set(itemsDesign, { scale: 1, opacity: 1, backgroundSize: "100%", transformOrigin: "center center" });
    itemsDesign.forEach((item) => {
      item.addEventListener("mouseenter", () => {
        gsap.killTweensOf(itemsDesign);
        gsap.to(itemsDesign, { scale: 0.95, opacity: 0.15, backgroundSize: "100%", duration: 0.3, ease: "power2.inOut" });
        gsap.to(item, { scale: 1.1, opacity: 1, backgroundSize: "110%", duration: 0.6, ease: "elastic.out(1,1)" });
      });
    });
    const containerDesign = itemsDesign[0]?.parentElement;
    if (containerDesign) {
      containerDesign.addEventListener("mouseleave", () => {
        gsap.killTweensOf(itemsDesign);
        gsap.to(itemsDesign, { scale: 1, opacity: 1, backgroundSize: "100%", duration: 0.3, ease: "power2.inOut" });
      });
    }

    // Techstack hover — Dev
    const itemsDev = document.querySelectorAll(".techstackslidedevportfoliohome");
    gsap.set(itemsDev, { scale: 1, opacity: 1, backgroundSize: "100%", transformOrigin: "center center" });
    itemsDev.forEach((item) => {
      item.addEventListener("mouseenter", () => {
        gsap.killTweensOf(itemsDev);
        gsap.to(itemsDev, { scale: 0.95, opacity: 0.15, backgroundSize: "100%", duration: 0.3, ease: "power2.inOut" });
        gsap.to(item, { scale: 1.1, opacity: 1, backgroundSize: "110%", duration: 0.6, ease: "elastic.out(1,1)" });
      });
    });
    const containerDev = itemsDev[0]?.parentElement;
    if (containerDev) {
      containerDev.addEventListener("mouseleave", () => {
        gsap.killTweensOf(itemsDev);
        gsap.to(itemsDev, { scale: 1, opacity: 1, backgroundSize: "100%", duration: 0.3, ease: "power2.inOut" });
      });
    }
  }


  // ── Work Experience ──────────────────────────────────────
  const expWrapper      = document.querySelector('.experienceitemlistportfoliohome');
  const expItems        = Array.from(document.querySelectorAll('.experienceitemportfoliohome'));
  const expDescriptions = expItems.map(el => el.querySelector('.experienceitemdescriptionportfoliohome'));
  const expParagraphs   = expItems.map(el => el.querySelector('.experienceitemdescriptionportfoliohome p'));

  if (expWrapper && expItems.length) {
    let naturalHeights = [], expandedHeights = [];
    const isMobile = () => window.innerWidth <= 767;

    const reset = () => {
      gsap.killTweensOf([...expItems, ...expDescriptions]);
      expItems.forEach(el => { el.style.marginTop = ''; gsap.set(el, { y: 0 }); });
      expDescriptions.forEach(el => el.style.height = '0px');
      expWrapper.style.height = ''; expWrapper.style.overflow = '';
    };

    const snapshot = () => {
      gsap.killTweensOf([...expItems, ...expDescriptions]);
      expItems.forEach(el => { el.style.marginTop = ''; gsap.set(el, { y: 0 }); });
      expDescriptions.forEach(el => el.style.height = '0px');
      naturalHeights   = expItems.map(el => el.offsetHeight);
      expandedHeights  = expParagraphs.map(p => p.offsetHeight + 30);
      expWrapper.style.height   = naturalHeights.reduce((a, b) => a + b, 0) + 'px';
      expWrapper.style.overflow = 'hidden';
    };

    if (!isMobile()) snapshot();
    window.addEventListener('resize', () => { if (isMobile()) reset(); else snapshot(); });

    expItems.forEach((item, hoveredIndex) => {
      const isBottom = hoveredIndex >= 2;
      item.addEventListener('mouseenter', () => {
        if (isMobile()) return;
        const net = expandedHeights[hoveredIndex] - naturalHeights[hoveredIndex];
        let shiftAbove;
        if (!isBottom) {
          shiftAbove = naturalHeights.slice(0, hoveredIndex).reduce((a, b) => a + b, 0);
        } else {
          shiftAbove = hoveredIndex === expItems.length - 1
            ? net + naturalHeights[hoveredIndex - 1] : net;
        }
        expItems.forEach((el, i) => {
          if (i < hoveredIndex) gsap.to(el, { y: -shiftAbove, duration: 1, ease: 'elastic.out(1,1)' });
        });
        gsap.to(item, { marginTop: -shiftAbove, duration: 1, ease: 'elastic.out(1,1)' });
        gsap.to(expDescriptions[hoveredIndex], { height: expandedHeights[hoveredIndex], duration: 1, ease: 'elastic.out(1,1)' });
      });
      item.addEventListener('mouseleave', () => {
        if (isMobile()) return;
        gsap.killTweensOf([...expItems, ...expDescriptions]);
        expItems.forEach(el => gsap.to(el, { y: 0, marginTop: 0, duration: 0.5, ease: 'power2.out' }));
        expDescriptions.forEach(el => gsap.to(el, { height: 0, duration: 0.4, ease: 'power2.out' }));
      });
    });
  }


  // ── Location Rive ────────────────────────────────────────
  const canvasLocation = document.getElementById("riveCanvasLocation");
  if (canvasLocation) {
    const riveLayoutLocation = new rive.Layout({ fit: rive.Fit.Layout, layoutScaleFactor: 1.0 });
    let riveCanvasLocation, viewModelInstance;

    riveCanvasLocation = new rive.Rive({
      src: "https://cdn.prod.website-files.com/689264804772f69d2a181b3d/69a0fb5de9cb89f2f1f87f73_2f6c93733712656f246c43d6328aa088_portfolio_location.riv",
      canvas: canvasLocation,
      autoplay: true,
      layout: riveLayoutLocation,
      artboard: "Artboard",
      stateMachines: "State Machine 1",
      isTouchScrollEnabled: true,
      onLoad() {
        const vm = riveCanvasLocation.viewModelByName("SliderVM");
        if (vm) {
          viewModelInstance = vm.instanceByName("Instance");
          if (viewModelInstance) riveCanvasLocation.bindViewModelInstance(viewModelInstance);
        }
        riveCanvasLocation.resizeDrawingSurfaceToCanvas();
        const inputs = riveCanvasLocation.stateMachineInputs("State Machine 1");
        const loadLocationInput = inputs.find(i => i.name === "loadLocation");
        requestAnimationFrame(() => {
          gsap.to(canvasLocation, { delay: 0.5, opacity: 1, duration: 0.5, ease: "power1.out" });
        });

        let lastWidth = canvasLocation.clientWidth, lastHeight = canvasLocation.clientHeight, resizing = false;
        new ResizeObserver(entries => {
          if (resizing) return;
          const { width, height } = entries[0].contentRect;
          if (Math.abs(width - lastWidth) > 1 || Math.abs(height - lastHeight) > 1) {
            lastWidth = width; lastHeight = height; resizing = true;
            requestAnimationFrame(() => { riveCanvasLocation.resizeDrawingSurfaceToCanvas(); resizing = false; });
          }
        }).observe(canvasLocation);

        ScrollTrigger.create({
          trigger: "#riveCanvasLocation",
          start: "bottom 100%",
          onEnter() { loadLocationInput.value = true; }
        });
      }
    });
  }


  // ── Personal Photos Slider ───────────────────────────────
  setTimeout(() => {
    const sliderElPersonal = document.querySelector("#blazeSliderPersonal");
    if (!sliderElPersonal) return;

    window.blazeSliderPersonal = null;
    sliderElPersonal.removeAttribute('data-blaze-index');
    sliderElPersonal.removeAttribute('data-blaze-track-transition');

    const track = sliderElPersonal.querySelector('.blaze-track');
    if (track) track.style.cssText = '';

    window.blazeSliderPersonal = new BlazeSlider(sliderElPersonal, {
      all: {
        enableAutoplay: true,
        slidesToScroll: 1,
        slidesToShow: 1,
        loop: true,
        autoplayInterval: 8000,
        transitionDuration: 2500,
        stopAutoplayOnInteraction: false,
        transitionTimingFunction: 'cubic-bezier(.25, 1.4, .4, 1)',
      }
    });
  }, 100);

} // ← END OF initHomePage()


// ============================================================
// COPYLEAKS ANIMATIONS PAGE
// ============================================================

function initCopyleaksAnimations() {
  // Hover binding is handled inside initLottieElements after each instance loads
}


// ============================================================
// COPYLEAKS WEBSITE PAGE
// ============================================================

function initCopyleaksWebsite() {

}


// ============================================================
// COPYLEAKS MARKETING PAGE
// ============================================================

function initCopyleaksMarketing() {

  const css = (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

  window.marketingSlider1 = new Splide('#marketingSlider1', {
    type: 'slide',
    drag: 'free',
    perPage: 3,
    perMove: 1,
    focus: '1',
    arrows: false,
    pagination: false,
    autoplay: false,
    snap: true,
    speed: 3000,
    interval: 5000,
    padding: { left: css('--_portfolio-spacing---spacing-large'), right: css('--_portfolio-spacing---spacing-large') },
    easing: 'cubic-bezier(.09,1.88,.5,.92)',

    breakpoints: {
      992: {
        padding: { left: css('--_portfolio-spacing---spacing-medium'), right: css('--_portfolio-spacing---spacing-medium') },
        perPage: 3,
      },
      768: {
        padding: { left: css('--_portfolio-spacing---spacing-small'), right: css('--_portfolio-spacing---spacing-small') },
        perPage: 2,
      },
      480: {
        padding: { left: css('--_portfolio-spacing---spacing-tiny'), right: css('--_portfolio-spacing---spacing-tiny') },
        perPage: 1,
      },
    }
  });

  window.marketingSlider2 = new Splide('#marketingSlider2', {
    type: 'slide',
    drag: 'free',
    perPage: 3,
    perMove: 1,
    focus: '1',
    arrows: false,
    pagination: false,
    autoplay: false,
    snap: true,
    speed: 3000,
    interval: 5000,
    padding: { left: css('--_portfolio-spacing---spacing-large'), right: css('--_portfolio-spacing---spacing-large') },
    easing: 'cubic-bezier(.09,1.88,.5,.92)',

    breakpoints: {
      992: {
        padding: { left: css('--_portfolio-spacing---spacing-medium'), right: css('--_portfolio-spacing---spacing-medium') },
        perPage: 3,
      },
      768: {
        padding: { left: css('--_portfolio-spacing---spacing-small'), right: css('--_portfolio-spacing---spacing-small') },
        perPage: 2,
      },
      480: {
        padding: { left: css('--_portfolio-spacing---spacing-tiny'), right: css('--_portfolio-spacing---spacing-tiny') },
        perPage: 1,
      },
    }
  });

  window.marketingSlider3 = new Splide('#marketingSlider3', {
    type: 'slide',
    drag: 'free',
    perPage: 3,
    perMove: 1,
    focus: '1',
    arrows: false,
    pagination: false,
    autoplay: false,
    snap: true,
    speed: 3000,
    interval: 5000,
    padding: { left: css('--_portfolio-spacing---spacing-large'), right: css('--_portfolio-spacing---spacing-large') },
    easing: 'cubic-bezier(.09,1.88,.5,.92)',

    breakpoints: {
      992: {
        padding: { left: css('--_portfolio-spacing---spacing-medium'), right: css('--_portfolio-spacing---spacing-medium') },
        perPage: 3,
      },
      768: {
        padding: { left: css('--_portfolio-spacing---spacing-small'), right: css('--_portfolio-spacing---spacing-small') },
        perPage: 2,
      },
      480: {
        padding: { left: css('--_portfolio-spacing---spacing-tiny'), right: css('--_portfolio-spacing---spacing-tiny') },
        perPage: 1,
      },
    }
  });

  window.marketingSlider4 = new Splide('#marketingSlider4', {
    type: 'slide',
    drag: 'free',
    perPage: 3,
    perMove: 1,
    focus: '1',
    arrows: false,
    pagination: false,
    autoplay: false,
    snap: true,
    speed: 3000,
    interval: 5000,
    padding: { left: css('--_portfolio-spacing---spacing-large'), right: css('--_portfolio-spacing---spacing-large') },
    easing: 'cubic-bezier(.09,1.88,.5,.92)',

    breakpoints: {
      992: {
        padding: { left: css('--_portfolio-spacing---spacing-medium'), right: css('--_portfolio-spacing---spacing-medium') },
        perPage: 3,
      },
      768: {
        padding: { left: css('--_portfolio-spacing---spacing-small'), right: css('--_portfolio-spacing---spacing-small') },
        perPage: 2,
      },
      480: {
        padding: { left: css('--_portfolio-spacing---spacing-tiny'), right: css('--_portfolio-spacing---spacing-tiny') },
        perPage: 1,
      },
    }
  });
  
  window.marketingSlider1.mount();
  window.marketingSlider2.mount();
  window.marketingSlider3.mount();
  window.marketingSlider4.mount();
}


// ============================================================
// PROFILE TEXT LOOP
// Runs once — interval persists across transitions naturally
// ============================================================

(function() {
  const els = document.querySelectorAll(".profiletextitemportfolio.name");
  if (!els.length) return;
  const TEXTS = ["Eric Lauterbach", "Design Portfolio"];
  els.forEach(function(el) {
    let current = 0;
    el.style.display = "inline-block";
    el.style.whiteSpace = "nowrap";
    el.style.width = el.getBoundingClientRect().width + "px";
    function cycle() {
      const splitOut = new SplitText(el, { type: "chars" });
      gsap.to(splitOut.chars, {
        y: "-50%", opacity: 0, duration: 0.4, ease: "power2.in", stagger: 0.02,
        onComplete() {
          splitOut.revert();
          current = (current + 1) % TEXTS.length;
          el.textContent = TEXTS[current];
          const splitIn = new SplitText(el, { type: "chars" });
          gsap.fromTo(splitIn.chars,
            { y: "50%", opacity: 0 },
            { y: "0%", opacity: 1, duration: 0.4, ease: "power3.out", stagger: 0.02,
              onComplete() { splitIn.revert(); }
            }
          );
        }
      });
    }
    setInterval(cycle, 4000);
  });
})();


// ============================================================
// TOOLTIP SYSTEM
// Runs once — MutationObserver handles new elements after Barba swaps
// ============================================================

(function() {
  const OFFSET = 10, FOLLOW_EASE = 0.1, NUDGE_AMOUNT = 40;
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let posX = mouseX, posY = mouseY;
  let scaleVal = 0.25, side = 'right', targetOffsetX = OFFSET;
  let nudgeY = 0, currentNudgeY = 0, isVisible = false, currentOffsetX = OFFSET;
  let currentHovered = null;
  let transitionActive = false;

  const container = document.querySelector('.tooltipcontainerportfolio');
  if (!container) { console.warn('[Tooltip] .tooltipcontainerportfolio not found.'); return; }

  document.body.appendChild(container);

  let tooltipEl = container.querySelector('.tooltip-inner');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip-inner';
    container.appendChild(tooltipEl);
  }

  Object.assign(container.style, {
    position: 'fixed', top: '0px', left: '0px',
    pointerEvents: 'none', zIndex: '9999',
    transformOrigin: 'left center', opacity: '0',
  });

  function setSide(newSide) {
    if (side === newSide) return;
    side = newSide;
    targetOffsetX = side === 'left' ? -(container.offsetWidth + OFFSET) : OFFSET;
    container.style.transformOrigin = side === 'left' ? 'right center' : 'left center';
  }

  function checkSide() {
    setSide(container.offsetWidth > window.innerWidth - mouseX - OFFSET ? 'left' : 'right');
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (isVisible) checkSide();
  });

  gsap.ticker.add(() => {
    posX           += (mouseX - posX) * FOLLOW_EASE;
    posY           += (mouseY - posY) * FOLLOW_EASE;
    currentOffsetX += (targetOffsetX - currentOffsetX) * FOLLOW_EASE;
    currentNudgeY  += (nudgeY - currentNudgeY) * FOLLOW_EASE;
    container.style.transform = `translate(${posX + currentOffsetX}px, ${posY - container.offsetHeight / 2 + currentNudgeY}px) scale(${scaleVal})`;
  });

  function showTooltip(text) {
    if (transitionActive) return;
    tooltipEl.textContent = text;
    isVisible = true;
    requestAnimationFrame(() => {
      checkSide();
      gsap.killTweensOf(container);
      gsap.to({ val: scaleVal }, { val: 1, duration: 0.7, ease: 'elastic.out(1,1)',
        onUpdate: function() { scaleVal = this.targets()[0].val; }
      });
      gsap.to(container, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    });
  }

  function hideTooltip() {
    isVisible = false;
    nudgeY = 0;
    currentNudgeY = 0;
    currentHovered = null;
    setSide('right');
    gsap.killTweensOf(container);
    gsap.to({ val: scaleVal }, { val: 0.25, duration: 0.2, ease: 'power2.in',
      onUpdate: function() { scaleVal = this.targets()[0].val; }
    });
    gsap.to(container, { opacity: 0, duration: 0.2, ease: 'power2.in' });
  }

  function forceHideTooltip() {
    isVisible = false;
    nudgeY = 0;
    currentNudgeY = 0;
    currentHovered = null;
    setSide('right');
    gsap.killTweensOf(container);
    scaleVal = 0.25;
    gsap.set(container, { opacity: 0 });
  }

  window.hideTooltip = forceHideTooltip;
  window.lockTooltip = () => { transitionActive = true; forceHideTooltip(); };
  window.unlockTooltip = () => { transitionActive = false; };

  const bound = new WeakSet();

  function bindTooltipElements() {
    document.querySelectorAll('[data-tooltip]').forEach((el) => {
      if (bound.has(el)) return;
      bound.add(el);
      el.addEventListener('mouseenter', () => {
        currentHovered = el;
        const t = el.getAttribute('data-tooltip');
        if (t) showTooltip(t);
      });
      el.addEventListener('mouseleave', () => {
        currentHovered = null;
        hideTooltip();
      });
    });
    document.querySelectorAll('[data-tooltip-nudge]').forEach((el) => {
      if (bound.has(el)) return;
      bound.add(el);
      el.addEventListener('mouseenter', () => { nudgeY = NUDGE_AMOUNT; });
      el.addEventListener('mouseleave', () => { nudgeY = 0; });
    });
  }

  bindTooltipElements();
  new MutationObserver(() => bindTooltipElements()).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('mouseleave', (e) => { if (e.relatedTarget === null) forceHideTooltip(); });

})();


// ============================================================
// SMOOTH SCROLL — first load only
// Barba's after hook calls initSmoother() on subsequent navigations
// ============================================================

window.smoother = ScrollSmoother.create({
  wrapper: '#smooth-wrapper',
  content: '#smooth-content',
  smooth: 1,
  effects: true,
  normalizeScroll: true,
});


// ============================================================
// RUN ON FIRST PAGE LOAD
// ============================================================

function onPageLoad() {
  initAll();

  const namespace = document.querySelector('[data-barba="container"]')?.dataset?.barbaNamespace;

  if (namespace === 'home') initHomePage();
  if (namespace === 'copyleaks-animations') {
    setTimeout(() => {
      initLottieElements();
      initCopyleaksAnimations();
    }, 100);
  }
  if (namespace === 'copyleaks-website') initCopyleaksWebsite();
  if (namespace === 'copyleaks-marketing') {
    setTimeout(() => {
      initCopyleaksMarketing();
    }, 100);
  }

  // Entrance animations — every page, after fonts and layout are ready
  setTimeout(() => {
    ScrollTrigger.refresh();
    initEntranceAnimations();
  }, 300);
}

// Handle both cases — already loaded or not yet
if (document.readyState === 'complete') {
  onPageLoad();
} else {
  window.addEventListener('load', onPageLoad);
}
