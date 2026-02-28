/**
 * CSRD NG911 - Hybrid Global Search Engine
 * Merges static search index with live localStorage edits.
 */

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('docSearch');
    if (!input) return;

    // Create dropdown container
    const searchContainer = input.closest('.hero-search');
    if (searchContainer) {
        searchContainer.style.position = 'relative';
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.style.display = 'none';
    searchContainer.appendChild(dropdown);

    // Hide old card filtering if someone types (since we are replacing it globally)
    input.addEventListener('input', function () {
        const q = this.value.toLowerCase().trim();

        // Show/hide link cards just like before (for the quick-nav section)
        const cards = document.querySelectorAll('.link-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = q === '' || text.includes(q) ? '' : 'none';
        });

        if (q.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        // Search the global index
        if (!window.CSRD_SEARCH_INDEX) return;

        let results = [];

        window.CSRD_SEARCH_INDEX.forEach(page => {
            // Check Live Editor Cache first
            let searchableText = page.content;
            const liveEdit = localStorage.getItem('csrd_page_' + page.pageId);

            if (liveEdit) {
                // Parse the raw HTML blob into pure text to search it safely
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = liveEdit;
                searchableText = tempDiv.textContent || tempDiv.innerText || "";
                searchableText = searchableText.replace(/\s+/g, ' ').trim();
            }

            const lowerContent = searchableText.toLowerCase();
            const matchIndex = lowerContent.indexOf(q);

            if (matchIndex !== -1) {
                // Extract snippet
                const start = Math.max(0, matchIndex - 40);
                const end = Math.min(searchableText.length, matchIndex + q.length + 40);
                let snippet = searchableText.substring(start, end);

                // Add ellipsis if truncated
                if (start > 0) snippet = '...' + snippet;
                if (end < searchableText.length) snippet = snippet + '...';

                // Highlight the match query
                const regex = new RegExp(`(${q})`, 'gi');
                const highlightedSnippet = snippet.replace(regex, '<mark>$1</mark>');

                results.push({
                    title: page.title,
                    path: page.path,
                    snippet: highlightedSnippet
                });
            }
        });

        // Render Results
        dropdown.innerHTML = '';
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="search-empty">No matching results found across the documentation.</div>';
        } else {
            // Cap at 6 results to stay snappy
            results.slice(0, 6).forEach(res => {
                const item = document.createElement('a');
                item.href = res.path + '?sq=' + encodeURIComponent(q);
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div class="search-result-title"><i class="fas fa-file-alt"></i> ${res.title}</div>
                    <div class="search-result-snippet">${res.snippet}</div>
                `;
                dropdown.appendChild(item);
            });
        }
        dropdown.style.display = 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Re-open if clicking back in
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) {
            dropdown.style.display = 'block';
        }
    });
});
