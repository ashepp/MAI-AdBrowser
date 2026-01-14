// Ad Image Viewer Application
// DZI-based viewer with MSN vertical filtering

class AdViewer {
    constructor() {
        this.viewer = null;
        this.metadata = null;
        this.ads = [];
        this.filteredAds = [];
        this.overlays = [];
        this.activeFilters = {
            vertical: null
        };
        
        this.init();
    }

    async init() {
        console.log('Initializing AdViewer with DZI...');
        
        // Load metadata
        await this.loadMetadata();
        
        // Initialize OpenSeadragon with DZI
        this.initViewer();
        
        // Setup filters
        this.setupFilters();
        
        // Setup keyboard shortcuts
        this.setupKeyboard();
        
        // Hide loading indicator
        setTimeout(() => {
            const loading = document.getElementById('loading');
            if (loading) loading.classList.add('hidden');
        }, 500);
    }

    async loadMetadata() {
        try {
            const response = await fetch('data/ads.json');
            if (!response.ok) throw new Error('Failed to load ads.json');
            
            this.metadata = await response.json();
            this.ads = this.metadata.ads || [];
            this.filteredAds = [...this.ads];
            
            console.log(`Loaded ${this.ads.length} ads in ${this.metadata.gridSize.cols}x${this.metadata.gridSize.rows} grid`);
            this.updateStats();
        } catch (error) {
            console.error('Error loading metadata:', error);
        }
    }

    initViewer() {
        this.viewer = OpenSeadragon({
            id: 'openseadragon-viewer',
            prefixUrl: 'lib/openseadragon-bin-4.1.0/images/',
            tileSources: 'images/collage/collage.dzi',
            showNavigationControl: false,
            showNavigator: true,
            navigatorPosition: 'BOTTOM_RIGHT',
            navigatorSizeRatio: 0.15,
            gestureSettingsMouse: {
                clickToZoom: false,
                dblClickToZoom: true,
                scrollToZoom: true,
                flickEnabled: true,
                dragToPan: true
            },
            gestureSettingsTouch: {
                pinchToZoom: true,
                flickEnabled: true,
                dragToPan: true
            },
            minZoomLevel: 0.1,
            maxZoomLevel: 5,
            visibilityRatio: 0.5,
            constrainDuringPan: true,
            animationTime: 0.5,
            springStiffness: 10,
            zoomPerScroll: 1.4,
            homeFillsViewer: true,
            immediateRender: false
        });

        this.viewer.addHandler('open', () => {
            console.log('DZI opened successfully');
            // Fit to viewport on load
            this.viewer.viewport.goHome(true);
            this.updateStats();
        });

        this.viewer.addHandler('canvas-click', (event) => {
            this.handleClick(event);
        });

        this.viewer.addHandler('zoom', () => {
            this.updateZoomIndicator();
        });
    }

    setupFilters() {
        const filterContainer = document.getElementById('size-options') || 
                               document.querySelector('.filter-options');
        
        if (!filterContainer || !this.metadata) return;
        
        // Clear existing and add vertical filters
        filterContainer.innerHTML = '';
        
        const verticals = this.metadata.verticals || [];
        
        // Add "All" option
        const allLabel = document.createElement('label');
        allLabel.className = 'filter-option active';
        allLabel.innerHTML = `
            <input type="radio" name="vertical" value="" checked>
            <span>All (${this.ads.length})</span>
        `;
        filterContainer.appendChild(allLabel);
        
        // Add each vertical
        verticals.forEach(vertical => {
            const count = this.ads.filter(ad => ad.vertical === vertical).length;
            const label = document.createElement('label');
            label.className = 'filter-option';
            label.innerHTML = `
                <input type="radio" name="vertical" value="${vertical}">
                <span>${vertical} (${count})</span>
            `;
            filterContainer.appendChild(label);
        });
        
        // Add event listeners
        filterContainer.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', (e) => {
                this.applyVerticalFilter(e.target.value);
                
                // Update active state
                filterContainer.querySelectorAll('.filter-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                e.target.closest('.filter-option').classList.add('active');
            });
        });
        
        // Update filter section title
        const filterTitle = document.querySelector('.filter-group h3');
        if (filterTitle) filterTitle.textContent = 'MSN Vertical';
    }

    applyVerticalFilter(vertical) {
        console.log('Filtering by vertical:', vertical || 'All');
        
        this.activeFilters.vertical = vertical || null;
        
        // Clear existing overlays
        this.clearOverlays();
        
        if (!vertical) {
            // Show all - remove dim overlays
            this.filteredAds = [...this.ads];
        } else {
            // Filter and dim non-matching ads
            this.filteredAds = this.ads.filter(ad => ad.vertical === vertical);
            this.dimNonMatchingAds(vertical);
        }
        
        this.updateStats();
    }

    dimNonMatchingAds(selectedVertical) {
        if (!this.metadata) return;
        
        const { width: collageWidth, height: collageHeight } = this.metadata.collageSize;
        
        // Create dim overlays for non-matching ads
        this.ads.forEach(ad => {
            if (ad.vertical !== selectedVertical) {
                const pos = ad.gridPosition;
                
                // Convert pixel position to viewport coordinates
                const x = pos.x / collageWidth;
                const y = pos.y / collageHeight;
                const w = pos.width / collageWidth;
                const h = pos.height / collageHeight;
                
                const overlay = document.createElement('div');
                overlay.className = 'ad-dim-overlay';
                overlay.style.cssText = `
                    background: rgba(0, 0, 0, 0.7);
                    pointer-events: none;
                `;
                
                this.viewer.addOverlay({
                    element: overlay,
                    location: new OpenSeadragon.Rect(x, y, w, h)
                });
                
                this.overlays.push(overlay);
            }
        });
    }

    clearOverlays() {
        this.overlays.forEach(overlay => {
            this.viewer.removeOverlay(overlay);
        });
        this.overlays = [];
    }

    handleClick(event) {
        if (!event.quick) return; // Only handle clicks, not drags
        
        const viewportPoint = this.viewer.viewport.pointFromPixel(event.position);
        const imagePoint = this.viewer.viewport.viewportToImageCoordinates(viewportPoint);
        
        // Find which ad was clicked
        const clickedAd = this.findAdAtPosition(imagePoint.x, imagePoint.y);
        
        if (clickedAd) {
            this.showAdInfo(clickedAd, event.position);
        } else {
            this.hideAdInfo();
        }
    }

    findAdAtPosition(x, y) {
        if (!this.metadata) return null;
        
        for (const ad of this.ads) {
            const pos = ad.gridPosition;
            if (x >= pos.x && x < pos.x + pos.width &&
                y >= pos.y && y < pos.y + pos.height) {
                return ad;
            }
        }
        return null;
    }

    showAdInfo(ad, screenPosition) {
        let panel = document.getElementById('ad-info-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'ad-info-panel';
            panel.className = 'ad-info-panel';
            document.body.appendChild(panel);
        }
        
        panel.innerHTML = `
            <div class="ad-info-header">
                <h3>${ad.title}</h3>
                <button class="close-btn" onclick="adViewer.hideAdInfo()">×</button>
            </div>
            <div class="ad-info-content">
                <p><strong>Vertical:</strong> ${ad.vertical}</p>
                <p><strong>Size:</strong> ${ad.dimensions.width}×${ad.dimensions.height}</p>
                <p><strong>Grid Position:</strong> Row ${ad.gridPosition.row + 1}, Col ${ad.gridPosition.col + 1}</p>
            </div>
        `;
        
        // Position panel near click
        const x = Math.min(screenPosition.x + 20, window.innerWidth - 320);
        const y = Math.min(screenPosition.y + 20, window.innerHeight - 200);
        
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.classList.add('visible');
    }

    hideAdInfo() {
        const panel = document.getElementById('ad-info-panel');
        if (panel) panel.classList.remove('visible');
    }

    updateStats() {
        const statsEl = document.getElementById('ad-count');
        if (statsEl) {
            const filtered = this.filteredAds.length;
            const total = this.ads.length;
            statsEl.textContent = filtered === total ? 
                `${total} ads` : 
                `${filtered} of ${total} ads`;
        }
    }

    updateZoomIndicator() {
        const zoomEl = document.getElementById('zoom-level');
        if (zoomEl && this.viewer) {
            const zoom = this.viewer.viewport.getZoom();
            zoomEl.textContent = `${Math.round(zoom * 100)}%`;
        }
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAdInfo();
                this.applyVerticalFilter(null);
                // Reset radio to "All"
                const allRadio = document.querySelector('input[name="vertical"][value=""]');
                if (allRadio) {
                    allRadio.checked = true;
                    allRadio.closest('.filter-option').classList.add('active');
                }
            }
            if (e.key === 'Home' || e.key === 'h') {
                this.viewer.viewport.goHome();
            }
        });
    }

    // Zoom controls
    zoomIn() {
        this.viewer.viewport.zoomBy(1.5);
    }

    zoomOut() {
        this.viewer.viewport.zoomBy(0.67);
    }

    resetView() {
        this.viewer.viewport.goHome();
    }
}

// Initialize viewer when DOM is ready
let adViewer;
document.addEventListener('DOMContentLoaded', () => {
    adViewer = new AdViewer();
});

// Expose for button onclick handlers
window.adViewer = adViewer;
