/* ============================================
   Anchor Enterprise — Scripts
   ============================================ */

(function () {
    'use strict';

    // --- Scroll Reveal ---
    const reveals = document.querySelectorAll('.reveal');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    reveals.forEach((el) => observer.observe(el));

    // --- Nav Scroll Effect ---
    const nav = document.getElementById('nav');
    let lastScroll = 0;

    function onScroll() {
        const y = window.scrollY;
        if (y > 40) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
        lastScroll = y;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // --- Mobile Menu ---
    const toggle = document.getElementById('mobile-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (toggle && mobileMenu) {
        toggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
            toggle.classList.toggle('active');
        });

        // Close on link click
        mobileMenu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('open');
                toggle.classList.remove('active');
            });
        });
    }

    // --- Smooth scroll for anchor links ---
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 80;
                const y = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        });
    });

    // --- Revenue analytics event hooks ---
    function trackEvent(name, props) {
        const payload = Object.assign({ path: window.location.pathname }, props || {});
        if (typeof window.gtag === 'function') {
            window.gtag('event', name, Object.assign({
                event_category: 'anchor_revenue',
                page_path: window.location.pathname,
            }, payload));
        }
        if (typeof window.plausible === 'function') {
            window.plausible(name, { props: payload });
        }
        window.dispatchEvent(new CustomEvent('anchor:analytics', { detail: { name, props: payload } }));
    }

    function datasetProps(el) {
        const props = {};
        Object.keys(el.dataset || {}).forEach((key) => {
            if (key.startsWith('trackProp')) {
                const propName = key.replace('trackProp', '').replace(/^./, (c) => c.toLowerCase());
                props[propName] = el.dataset[key];
            }
        });
        return props;
    }

    document.querySelectorAll('[data-track-event]').forEach((el) => {
        el.addEventListener('click', () => {
            trackEvent(el.dataset.trackEvent, datasetProps(el));
        });
    });

    document.querySelectorAll('a[href^="mailto:"]').forEach((el) => {
        if (!el.dataset.trackEvent) {
            el.addEventListener('click', () => trackEvent('email_click', { cta: 'mailto' }));
        }
    });

    document.querySelectorAll('a[href^="tel:"]').forEach((el) => {
        if (!el.dataset.trackEvent) {
            el.addEventListener('click', () => trackEvent('phone_click', { cta: 'tel' }));
        }
    });

    document.querySelectorAll('a[href*="calendar.app.google"]').forEach((el) => {
        if (!el.dataset.trackEvent) {
            el.addEventListener('click', () => trackEvent('book_call_click', { cta: 'calendar' }));
        }
    });

    // --- Lead capture forms ---
    const params = new URLSearchParams(window.location.search);

    function getFormValue(form, name) {
        const field = form.querySelector(`[name="${name}"]`);
        if (!field) return '';
        if (field.type === 'checkbox') return field.checked ? field.value : '';
        return field.value || '';
    }

    function buildLeadFallbackMailto(form) {
        const formId = getFormValue(form, 'form_id') || 'website lead form';
        const subject = `Anchor ${formId} request`;
        const lines = [
            'I tried to submit the Anchor website form, but the automated form path was unavailable.',
            '',
            `Name: ${getFormValue(form, 'full_name')}`,
            `Work email: ${getFormValue(form, 'email')}`,
            `Company: ${getFormValue(form, 'company')}`,
            `Role/title: ${getFormValue(form, 'title')}`,
            '',
            'AI proof question:',
            getFormValue(form, 'message'),
            '',
            `Page: ${getFormValue(form, 'landing_page') || window.location.href}`,
            `Referrer: ${getFormValue(form, 'referrer') || document.referrer || ''}`,
        ];
        return `mailto:clark@anchor-enterprise.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    }

    document.querySelectorAll('form[data-lead-form]').forEach((form) => {
        const status = form.querySelector('[data-form-status]');
        const setHidden = (name, value) => {
            const input = form.querySelector(`input[name="${name}"]`);
            if (input) input.value = value || '';
        };
        setHidden('landing_page', window.location.href);
        setHidden('referrer', document.referrer);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach((name) => {
            setHidden(name, params.get(name));
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]');
            const formData = new FormData(form);
            const formId = formData.get('form_id') || 'unknown';
            trackEvent('lead_form_submit', { formId: String(formId) });
            if (button) button.disabled = true;
            if (status) status.textContent = 'Sending request...';

            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: { accept: 'application/json' },
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.ok === false) {
                    throw new Error(result.error || 'The request could not be sent.');
                }
                form.reset();
                trackEvent('lead_form_success', { formId: String(formId) });
                if (status) status.textContent = 'Request received. Anchor will follow up shortly.';
            } catch (err) {
                trackEvent('lead_form_error', { formId: String(formId) });
                trackEvent('lead_form_mailto_fallback', { formId: String(formId) });
                const fallbackUrl = buildLeadFallbackMailto(form);
                if (status) {
                    status.innerHTML = 'The automated form is temporarily unavailable. Your email app should open with the request details filled in. If it does not, <a href="' + fallbackUrl + '">email Clark directly</a>.';
                }
                window.location.href = fallbackUrl;
            } finally {
                if (button) button.disabled = false;
            }
        });
    });

})();
