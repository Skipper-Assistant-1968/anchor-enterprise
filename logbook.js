/* ============================================
   The Logbook — pillar filter
   ============================================ */

(function () {
    'use strict';

    const chips = document.querySelectorAll('.chip');
    const grid = document.getElementById('entries-grid');
    const noResults = document.getElementById('entries-no-results');

    if (!chips.length || !grid) return;

    function applyFilter(pillar) {
        const cards = grid.querySelectorAll('.entry-card');
        let visibleCount = 0;

        cards.forEach((card) => {
            const cardPillar = card.getAttribute('data-pillar');
            const show = pillar === 'all' || cardPillar === pillar;
            card.style.display = show ? '' : 'none';
            if (show) visibleCount += 1;
        });

        // Hide empty state when filtering by a specific pillar (it's a placeholder for "All")
        const empty = grid.querySelector('.entries-empty');
        if (empty) {
            empty.style.display = pillar === 'all' ? '' : 'none';
        }

        // Show no-results banner only when filtering and no real cards match
        if (noResults) {
            const filtering = pillar !== 'all';
            const noCardsMatch = filtering && visibleCount === 0;
            noResults.hidden = !noCardsMatch;
        }
    }

    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            chips.forEach((c) => c.classList.remove('is-active'));
            chip.classList.add('is-active');
            const pillar = chip.getAttribute('data-pillar');
            applyFilter(pillar);

            // Sync URL hash for shareable filter state
            if (pillar === 'all') {
                history.replaceState(null, '', window.location.pathname);
            } else {
                history.replaceState(null, '', '#pillar-' + pillar);
            }
        });
    });

    // Restore filter from URL hash on load
    const hash = window.location.hash;
    if (hash && hash.startsWith('#pillar-')) {
        const pillar = hash.replace('#pillar-', '');
        const target = document.querySelector('.chip[data-pillar="' + pillar + '"]');
        if (target) {
            chips.forEach((c) => c.classList.remove('is-active'));
            target.classList.add('is-active');
            applyFilter(pillar);
        }
    }
})();
