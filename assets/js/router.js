/**
 * Client-side router for clean URLs on GitHub Pages
 * Automatically handles .html extension removal and dynamic content loading
 */

(function() {
    'use strict';

    // Router configuration
    const ROUTER_CONFIG = {
        // Base URL for the site
        baseUrl: window.location.origin,
        // Content container selector (where page content will be loaded)
        contentSelector: '#page-wrapper',
        // Loading indicator
        loadingClass: 'is-loading'
    };

    class Router {
        constructor() {
            this.currentPath = this.getCurrentPath();
            this.isInitialized = false;
            this.init();
        }

        /**
         * Initialize the router
         */
        init() {
            if (this.isInitialized) return;

            this.bindEvents();
            this.handleInitialLoad();
            this.isInitialized = true;
        }

        /**
         * Bind event listeners for navigation
         */
        bindEvents() {
            // Intercept all internal links
            document.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (link && this.isInternalLink(link)) {
                    e.preventDefault();
                    const path = this.getPathFromUrl(link.href);
                    this.navigate(path);
                }
            });

            // Handle browser back/forward buttons
            window.addEventListener('popstate', (e) => {
                if (e.state && e.state.path) {
                    this.loadContent(e.state.path, false);
                }
            });
        }

        /**
         * Handle initial page load (for direct visits to clean URLs)
         */
        handleInitialLoad() {
            const path = this.getCurrentPath();

            // If we're on a clean URL (no .html extension in current URL)
            // but the path suggests we need to load content
            if (path !== '/' && !path.includes('.html') && !path.includes('#')) {
                // Check if this is a direct visit to a clean URL
                // by seeing if the current document has the expected content
                const expectedTitle = this.getExpectedTitle(path);
                if (document.title !== expectedTitle) {
                    // Load the actual content
                    this.loadContent(path, false);
                }
            }
        }

        /**
         * Navigate to a new path
         * @param {string} path - Clean path (e.g., '/donate')
         */
        navigate(path) {
            if (path === this.currentPath) return;

            this.currentPath = path;
            this.loadContent(path, true);
        }

        /**
         * Load content for a given path
         * @param {string} path - Clean path
         * @param {boolean} updateHistory - Whether to update browser history
         */
        async loadContent(path, updateHistory = true) {
            const htmlFile = this.pathToHtmlFile(path);

            try {
                // Show loading state
                document.body.classList.add(ROUTER_CONFIG.loadingClass);

                const response = await fetch(htmlFile);
                if (!response.ok) {
                    throw new Error(`Failed to load ${htmlFile}`);
                }

                const html = await response.text();
                const newContent = this.extractContent(html);

                // Update the page content
                const contentContainer = document.querySelector(ROUTER_CONFIG.contentSelector);
                if (contentContainer) {
                    contentContainer.innerHTML = newContent;
                }

                // Scroll to top of the page
                window.scrollTo(0, 0);

                // Update page title
                const title = this.extractTitle(html);
                if (title) {
                    document.title = title;
                }

                // Update meta tags
                this.updateMetaTags(html);

                // Update URL without page reload
                if (updateHistory) {
                    const fullUrl = ROUTER_CONFIG.baseUrl + path;
                    window.history.pushState({ path: path }, '', fullUrl);
                }

                // Re-initialize any scripts or plugins that need it
                this.reinitializeScripts();

            } catch (error) {
                console.error('Router error:', error);
                // Fallback to regular navigation
                window.location.href = htmlFile;
            } finally {
                // Hide loading state
                document.body.classList.remove(ROUTER_CONFIG.loadingClass);
            }
        }

        /**
         * Convert clean path to HTML file path
         * @param {string} path - Clean path (e.g., '/donate')
         * @returns {string} HTML file path (e.g., 'donate.html')
         */
        pathToHtmlFile(path) {
            // Remove leading slash and add .html extension
            const cleanPath = path.startsWith('/') ? path.slice(1) : path;

            // Handle root path
            if (cleanPath === '' || cleanPath === '/') {
                return 'index.html';
            }

            // Handle paths with query parameters or fragments
            const basePath = cleanPath.split(/[?#]/)[0];

            return basePath + '.html';
        }

        /**
         * Extract content from HTML string
         * @param {string} html - Full HTML content
         * @returns {string} Content to replace
         */
        extractContent(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const content = doc.querySelector(ROUTER_CONFIG.contentSelector);

            return content ? content.innerHTML : html;
        }

        /**
         * Extract title from HTML string
         * @param {string} html - Full HTML content
         * @returns {string|null} Page title
         */
        extractTitle(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const titleElement = doc.querySelector('title');

            return titleElement ? titleElement.textContent : null;
        }

        /**
         * Update meta tags from loaded content
         * @param {string} html - Full HTML content
         */
        updateMetaTags(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Update canonical URL
            const canonical = doc.querySelector('link[rel="canonical"]');
            if (canonical) {
                const currentCanonical = document.querySelector('link[rel="canonical"]');
                if (currentCanonical) {
                    currentCanonical.href = canonical.href.replace('.html', '');
                }
            }

            // Update Open Graph URL
            const ogUrl = doc.querySelector('meta[property="og:url"]');
            if (ogUrl) {
                const currentOgUrl = document.querySelector('meta[property="og:url"]');
                if (currentOgUrl) {
                    currentOgUrl.content = ogUrl.content.replace('.html', '');
                }
            }
        }

        /**
         * Re-initialize scripts and plugins after content load
         */
        reinitializeScripts() {
            // Re-initialize scroll effects
            if (typeof $ !== 'undefined' && $.fn.scrolly) {
                $('.scrolly').scrolly({
                    speed: 1000,
                    offset: function() { return $('#header').outerHeight() + 10; }
                });
            }

            // Re-initialize dropdowns
            if (typeof $ !== 'undefined' && $.fn.dropotron) {
                $('#nav > ul').dropotron({
                    mode: 'fade',
                    noOpenerFade: true,
                    expandMode: (browser.mobile ? 'click' : 'hover')
                });
            }
        }

        /**
         * Check if a link is internal
         * @param {HTMLAnchorElement} link - Link element
         * @returns {boolean} True if internal link
         */
        isInternalLink(link) {
            const href = link.getAttribute('href');
            if (!href) return false;

            // Skip external links, anchors, and special protocols
            if (href.startsWith('http') && !href.includes(window.location.origin)) return false;
            if (href.startsWith('#')) return false;
            if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
            if (link.getAttribute('target') === '_blank') return false;

            return true;
        }

        /**
         * Get path from URL
         * @param {string} url - Full URL
         * @returns {string} Path component
         */
        getPathFromUrl(url) {
            try {
                const urlObj = new URL(url);
                return urlObj.pathname;
            } catch (e) {
                return url;
            }
        }

        /**
         * Get current path from window.location
         * @returns {string} Current path
         */
        getCurrentPath() {
            return window.location.pathname;
        }

        /**
         * Get expected title for a path (for initial load detection)
         * @param {string} path - Clean path
         * @returns {string} Expected title
         */
        getExpectedTitle(path) {
            // This is a simple heuristic - could be enhanced with a title map
            const titleMap = {
                '/': 'GIFT Canada - Registered Canadian Charity | Toronto Non-Profit Organization',
                '/donate': 'Donate to GIFT Canada - Support Humanitarian Aid & Medical Missions',
                '/mission': 'GIFT Canada - GIFT Vision & Mission',
                '/get-involved': 'GIFT Canada - Get Involved'
            };

            return titleMap[path] || 'GIFT Canada';
        }
    }

    // Initialize router when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.siteRouter = new Router();
        });
    } else {
        window.siteRouter = new Router();
    }

})();
