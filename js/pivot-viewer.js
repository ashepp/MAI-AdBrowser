// Pivot-style Ad Image Viewer
// Canvas-based viewer with pan/zoom and MSN vertical filtering

class PivotViewer {
    constructor() {
        this.ads = [];
        this.filteredAds = [];
        this.currentFilter = null;
        
        // Grid settings
        this.thumbnailSize = 60; // Base thumbnail size in pixels
        this.gap = 3;
        this.padding = 10;
        
        // Zoom/pan state
        this.scale = 1;
        this.minScale = 0.3;
        this.maxScale = 4;
        this.translateX = 0;
        this.translateY = 0;
        
        // Drag state
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.lastTranslateX = 0;
        this.lastTranslateY = 0;
        
        // DOM elements
        this.container = null;
        this.grid = null;
        
        this.init();
    }

    async init() {
        console.log('Initializing Pivot Viewer...');
        
        // Get DOM elements
        this.container = document.getElementById('grid-container');
        this.grid = document.getElementById('image-grid');
        
        // Load data
        await this.loadData();
        
        // Setup UI
        this.setupFilters();
        this.setupZoomControls();
        this.setupPanZoom();
        this.setupKeyboard();
        this.setupDetailPanel();
        
        // Render grid
        this.renderGrid();
        
        // Fit to viewport after images start loading
        setTimeout(() => this.fitToViewport(), 100);
        
        // Hide loading
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 500);
    }

    async loadData() {
        try {
            const response = await fetch('data/ads.json');
            const data = await response.json();
            
            this.ads = data.ads || [];
            this.filteredAds = [...this.ads];
            this.verticals = data.verticals || [];
            this.verticalCounts = data.verticalCounts || {};
            
            console.log(`Loaded ${this.ads.length} ads across ${this.verticals.length} verticals`);
            this.updateStats();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    setupFilters() {
        const container = document.getElementById('vertical-options');
        if (!container) return;
        
        container.innerHTML = '';
        
        // "All" option
        const allOption = this.createFilterOption('', 'All', this.ads.length, true);
        container.appendChild(allOption);
        
        // Vertical options
        this.verticals.forEach(vertical => {
            const count = this.verticalCounts[vertical] || 0;
            const option = this.createFilterOption(vertical, vertical, count, false);
            container.appendChild(option);
        });
    }

    createFilterOption(value, label, count, isActive) {
        const div = document.createElement('label');
        div.className = `filter-option${isActive ? ' active' : ''}`;
        div.innerHTML = `
            <input type="radio" name="vertical" value="${value}" ${isActive ? 'checked' : ''}>
            <span class="filter-label">${label}</span>
            <span class="filter-count">${count}</span>
        `;
        
        div.querySelector('input').addEventListener('change', (e) => {
            this.applyFilter(e.target.value);
            
            // Update active state
            document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('active'));
            div.classList.add('active');
        });
        
        return div;
    }

    applyFilter(vertical) {
        this.currentFilter = vertical || null;
        
        if (!vertical) {
            // Show all
            this.filteredAds = [...this.ads];
            document.getElementById('filter-status').textContent = 'All Verticals';
        } else {
            this.filteredAds = this.ads.filter(ad => ad.vertical === vertical);
            document.getElementById('filter-status').textContent = vertical;
        }
        
        // Update grid with dimming
        this.updateGridFilter();
        this.updateStats();
    }

    updateGridFilter() {
        const thumbnails = document.querySelectorAll('.ad-thumbnail');
        
        thumbnails.forEach(thumb => {
            const adId = parseInt(thumb.dataset.id);
            const ad = this.ads.find(a => a.id === adId);
            
            if (!this.currentFilter || ad.vertical === this.currentFilter) {
                thumb.classList.remove('dimmed');
            } else {
                thumb.classList.add('dimmed');
            }
        });
    }

    renderGrid() {
        if (!this.grid) return;
        
        // Calculate grid dimensions to fit viewport
        const containerRect = this.container.getBoundingClientRect();
        const availableWidth = containerRect.width - (this.padding * 2);
        
        // Calculate columns to make grid fit horizontally
        const cols = Math.floor(availableWidth / (this.thumbnailSize + this.gap));
        
        // Clear grid
        this.grid.innerHTML = '';
        this.grid.style.width = `${cols * (this.thumbnailSize + this.gap)}px`;
        
        // Create thumbnails
        this.ads.forEach((ad, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'ad-thumbnail';
            thumb.dataset.id = ad.id;
            thumb.style.width = `${this.thumbnailSize}px`;
            thumb.style.height = `${this.thumbnailSize}px`;
            
            const img = document.createElement('img');
            img.src = ad.imageUrl;
            img.alt = `Ad ${ad.id}`;
            img.loading = 'lazy'; // Lazy load for performance
            
            // Error handling for missing images
            img.onerror = () => {
                img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect fill="%231a1a2e" width="60" height="60"/><text x="30" y="35" text-anchor="middle" fill="%23666" font-size="10">No Image</text></svg>';
            };
            
            thumb.appendChild(img);
            
            // Click handler for detail
            thumb.addEventListener('click', () => this.showDetail(ad));
            
            this.grid.appendChild(thumb);
        });
        
        console.log(`Rendered ${this.ads.length} thumbnails in grid`);
    }

    fitToViewport() {
        if (!this.container || !this.grid) return;
        
        const containerRect = this.container.getBoundingClientRect();
        const gridRect = this.grid.getBoundingClientRect();
        
        // Calculate scale to fit
        const scaleX = (containerRect.width - 40) / (gridRect.width / this.scale);
        const scaleY = (containerRect.height - 40) / (gridRect.height / this.scale);
        
        this.scale = Math.min(scaleX, scaleY, 1.5); // Don't zoom in too much
        this.scale = Math.max(this.scale, this.minScale);
        
        // Center the grid
        const scaledWidth = (gridRect.width / this.scale) * this.scale;
        const scaledHeight = (gridRect.height / this.scale) * this.scale;
        
        this.translateX = (containerRect.width - scaledWidth) / 2;
        this.translateY = (containerRect.height - scaledHeight) / 2;
        
        this.translateX = Math.max(0, this.translateX);
        this.translateY = Math.max(0, this.translateY);
        
        this.applyTransform();
        this.updateZoomDisplay();
    }

    setupZoomControls() {
        document.getElementById('zoom-in').addEventListener('click', () => this.zoom(1.3));
        document.getElementById('zoom-out').addEventListener('click', () => this.zoom(0.7));
        document.getElementById('zoom-reset').addEventListener('click', () => this.fitToViewport());
        document.getElementById('fit-btn').addEventListener('click', () => this.fitToViewport());
        document.getElementById('home-btn').addEventListener('click', () => {
            this.applyFilter('');
            document.querySelector('input[name="vertical"][value=""]').checked = true;
            document.querySelectorAll('.filter-option').forEach((opt, i) => {
                opt.classList.toggle('active', i === 0);
            });
            this.fitToViewport();
        });
    }

    zoom(factor) {
        const newScale = this.scale * factor;
        
        if (newScale >= this.minScale && newScale <= this.maxScale) {
            // Zoom toward center
            const containerRect = this.container.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            
            const dx = (centerX - this.translateX) * (1 - factor);
            const dy = (centerY - this.translateY) * (1 - factor);
            
            this.translateX += dx;
            this.translateY += dy;
            this.scale = newScale;
            
            this.applyTransform();
            this.updateZoomDisplay();
        }
    }

    setupPanZoom() {
        // Mouse wheel zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const newScale = Math.min(Math.max(this.scale * factor, this.minScale), this.maxScale);
            
            if (newScale !== this.scale) {
                // Zoom toward mouse position
                const scaleRatio = newScale / this.scale;
                this.translateX = mouseX - (mouseX - this.translateX) * scaleRatio;
                this.translateY = mouseY - (mouseY - this.translateY) * scaleRatio;
                this.scale = newScale;
                
                this.applyTransform();
                this.updateZoomDisplay();
            }
        }, { passive: false });

        // Pan with mouse drag
        this.container.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ad-thumbnail')) return; // Don't drag when clicking thumbnails
            
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.lastTranslateX = this.translateX;
            this.lastTranslateY = this.translateY;
            this.container.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            
            this.translateX = this.lastTranslateX + dx;
            this.translateY = this.lastTranslateY + dy;
            
            this.applyTransform();
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.container.style.cursor = 'grab';
        });

        this.container.style.cursor = 'grab';
    }

    applyTransform() {
        if (!this.grid) return;
        this.grid.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }

    updateZoomDisplay() {
        const zoomEl = document.getElementById('zoom-level');
        if (zoomEl) {
            zoomEl.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }

    updateStats() {
        const visibleEl = document.getElementById('visible-count');
        const totalEl = document.getElementById('total-count');
        
        if (visibleEl) visibleEl.textContent = this.filteredAds.length;
        if (totalEl) totalEl.textContent = this.ads.length;
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    this.hideDetail();
                    this.applyFilter('');
                    document.querySelector('input[name="vertical"][value=""]').checked = true;
                    document.querySelectorAll('.filter-option').forEach((opt, i) => {
                        opt.classList.toggle('active', i === 0);
                    });
                    break;
                case 'h':
                case 'H':
                    this.fitToViewport();
                    break;
                case '+':
                case '=':
                    this.zoom(1.3);
                    break;
                case '-':
                    this.zoom(0.7);
                    break;
            }
        });
    }

    setupDetailPanel() {
        const backdrop = document.getElementById('panel-backdrop');
        const closeBtn = document.getElementById('close-detail');
        
        backdrop.addEventListener('click', () => this.hideDetail());
        closeBtn.addEventListener('click', () => this.hideDetail());
    }

    showDetail(ad) {
        const panel = document.getElementById('ad-detail-panel');
        const backdrop = document.getElementById('panel-backdrop');
        const image = document.getElementById('detail-image');
        const title = document.getElementById('detail-title');
        const content = document.getElementById('detail-content');
        
        title.textContent = `Ad #${ad.id}`;
        image.src = ad.imageUrl;
        
        content.innerHTML = `
            <div class="ad-detail-row">
                <span class="ad-detail-label">Vertical</span>
                <span class="ad-detail-value">${ad.vertical}</span>
            </div>
            <div class="ad-detail-row">
                <span class="ad-detail-label">Size</span>
                <span class="ad-detail-value">${ad.displaySize}</span>
            </div>
            <div class="ad-detail-row">
                <span class="ad-detail-label">Dimensions</span>
                <span class="ad-detail-value">${ad.dimensions.width} × ${ad.dimensions.height}</span>
            </div>
            <div class="ad-detail-row">
                <span class="ad-detail-label">Format</span>
                <span class="ad-detail-value">${ad.size.replace(/-/g, ' ')}</span>
            </div>
        `;
        
        panel.classList.add('visible');
        backdrop.classList.add('visible');
    }

    hideDetail() {
        document.getElementById('ad-detail-panel').classList.remove('visible');
        document.getElementById('panel-backdrop').classList.remove('visible');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.pivotViewer = new PivotViewer();
});
