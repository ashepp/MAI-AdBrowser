/**
 * Pivot Collection Viewer Application
 * Fluid, animated exploration of image collections with metadata
 */

// Helper function to render star rating
function renderStars(rating) {
    const r = parseInt(rating) || 0;
    const filled = '★'.repeat(Math.min(5, Math.max(0, r)));
    const empty = '☆'.repeat(5 - filled.length);
    return filled + empty;
}

class PivotApp {
    constructor() {
        // Data
        this.ads = [];
        this.filteredAds = [];
        this.visibleAds = [];
        
        // State
        this.currentGroupBy = '';
        this.currentSortBy = 'size';
        this.currentSortOrder = 'asc';
        this.activeFilters = {
            vertical: [],
            size: [],
            adType: [],
            rating: [],
            brand: [],
            status: []
        };
        
        // Pan state
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.panOffset = { x: 0, y: 0 };
        this.selectedIndex = -1;
        this.detailOpen = false;
        
        // Layout settings
        this.baseHeight = 50;  // Base height for thumbnails - width scales based on aspect ratio
        this.itemGap = 4;
        this.blockGap = 60;
        this.padding = 20;
        
        // Zoom
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 10;
        
        // DOM references
        this.elements = {};
        
        // Animation engine
        this.animator = new PivotAnimator({
            duration: 600,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        
        // Item element map
        this.itemElements = new Map();
        
        // Initialize
        this.init();
    }

    async init() {
        console.log('Initializing Pivot...');
        
        // Cache DOM elements
        this.cacheElements();
        
        // Load data
        await this.loadData();
        
        // Setup UI
        this.setupFilters();
        this.setupControls();
        this.setupKeyboard();
        
        // Initial render
        this.createItems();
        this.applyLayout();
        
        // Fit to viewport after a short delay to ensure layout is complete
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.fitToViewport();
                this.hideLoading();
            });
        });
        
        // Re-fit on window resize
        window.addEventListener('resize', () => {
            this.applyLayout();
            this.fitToViewport();
        });
    }

    cacheElements() {
        this.elements = {
            loading: document.getElementById('loading'),
            gridWrapper: document.getElementById('grid-wrapper'),
            gridContainer: document.getElementById('grid-container'),
            sidebar: document.getElementById('sidebar'),
            detailPanel: document.getElementById('detail-panel'),
            detailImage: document.getElementById('detail-image'),
            detailMeta: document.getElementById('detail-meta'),
            visibleCount: document.getElementById('visible-count'),
            totalCount: document.getElementById('total-count'),
            filteredCount: document.getElementById('filtered-count'),
            currentIndex: document.getElementById('current-index'),
            viewTitle: document.getElementById('view-title'),
            zoomLevel: document.getElementById('zoom-level'),
            groupBy: document.getElementById('group-by'),
            sortBy: document.getElementById('sort-by'),
            sortOrder: document.getElementById('sort-order')
        };
    }

    async loadData() {
        try {
            const response = await fetch('data/ads.json');
            const data = await response.json();
            
            this.ads = data.ads || [];
            this.filteredAds = [...this.ads];
            this.visibleAds = [...this.ads];
            
            // Extract unique values for filters
            this.filterValues = {
                vertical: [...new Set(this.ads.map(a => a.vertical))].sort(),
                size: [...new Set(this.ads.map(a => a.size))].sort(),
                adType: [...new Set(this.ads.map(a => a.adType).filter(Boolean))].sort(),
                rating: [...new Set(this.ads.map(a => a.rating).filter(Boolean))].sort((a, b) => b - a), // 5 stars first
                brand: [...new Set(this.ads.map(a => a.brand).filter(Boolean))].sort(),
                status: [...new Set(this.ads.map(a => a.status).filter(Boolean))].sort()
            };
            
            this.updateCounts();
            console.log(`Loaded ${this.ads.length} ads`);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }

    setupFilters() {
        // Populate filter options
        Object.entries(this.filterValues).forEach(([field, values]) => {
            const container = document.getElementById(`filter-${field}`);
            if (!container) return;
            
            container.innerHTML = '';
            
            values.forEach(value => {
                const count = this.ads.filter(a => a[field] === value).length;
                const option = document.createElement('div');
                option.className = 'filter-option';
                // Display stars for rating field
                const displayValue = field === 'rating' ? renderStars(value) : value;
                option.innerHTML = `
                    <input type="checkbox" id="filter-${field}-${value}" data-field="${field}" data-value="${value}">
                    <label for="filter-${field}-${value}">
                        <span class="${field === 'rating' ? 'rating-stars' : ''}">${displayValue}</span>
                        <span class="filter-count">${count}</span>
                    </label>
                `;
                container.appendChild(option);
                
                // Add change listener
                const checkbox = option.querySelector('input');
                checkbox.addEventListener('change', () => this.handleFilterChange(field, value, checkbox.checked));
            });
        });

        // Collapsible sections
        document.querySelectorAll('.filter-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
    }

    setupControls() {
        // Group by - track user selection
        this.elements.groupBy.addEventListener('change', (e) => {
            this.currentGroupBy = e.target.value;
            this._userSetGroup = e.target.value !== '';
            this.animateLayoutChange();
        });

        // Sort by
        this.elements.sortBy.addEventListener('change', (e) => {
            this.currentSortBy = e.target.value;
            this.sortAds();
            this.animateLayoutChange();
        });

        this.elements.sortOrder.addEventListener('change', (e) => {
            this.currentSortOrder = e.target.value;
            this.sortAds();
            this.animateLayoutChange();
        });

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoom-out').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('zoom-fit').addEventListener('click', () => this.fitToViewport());

        // Mouse wheel zoom (two-finger scroll = zoom, horizontal scroll = pan)
        this.elements.gridContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // Two-finger vertical scroll = zoom
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                const factor = e.deltaY > 0 ? 0.95 : 1.05;
                this.zoom(factor);
            } else if (Math.abs(e.deltaX) > 0) {
                // Horizontal scroll = pan horizontally
                this.panOffset.x -= e.deltaX;
                this.constrainPan();
                this.applyTransform();
            }
        }, { passive: false });
        
        // Mouse drag pan
        this.elements.gridContainer.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !e.target.closest('.grid-item')) {
                this.isPanning = true;
                this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
                this.elements.gridContainer.style.cursor = 'grabbing';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panOffset.x = e.clientX - this.panStart.x;
                this.panOffset.y = e.clientY - this.panStart.y;
                this.constrainPan();
                this.applyTransform();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.elements.gridContainer.style.cursor = '';
            }
        });

        // Detail panel controls
        document.getElementById('close-detail').addEventListener('click', () => this.closeDetail());
        document.getElementById('prev-item').addEventListener('click', () => this.navigateDetail(-1));
        document.getElementById('next-item').addEventListener('click', () => this.navigateDetail(1));
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (this.detailOpen) {
                switch (e.key) {
                    case 'Escape':
                        this.closeDetail();
                        break;
                    case 'ArrowLeft':
                        this.navigateDetail(-1);
                        break;
                    case 'ArrowRight':
                        this.navigateDetail(1);
                        break;
                }
            } else {
                switch (e.key) {
                    case '+':
                    case '=':
                        this.zoom(1.2);
                        break;
                    case '-':
                        this.zoom(0.8);
                        break;
                }
            }
        });
    }

    // Calculate item dimensions based on ad aspect ratio
    getItemDimensions(ad) {
        const dims = ad.dimensions || { width: 300, height: 250 }; // Default to medium rectangle
        const aspectRatio = dims.width / dims.height;
        const height = this.baseHeight;
        const width = Math.round(height * aspectRatio);
        return { width, height };
    }

    createItems() {
        this.elements.gridWrapper.innerHTML = '';
        this.itemElements.clear();
        
        this.ads.forEach((ad, index) => {
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.dataset.id = String(ad.id);  // Ensure string for consistency
            item.dataset.index = index;
            item.dataset.vertical = ad.vertical;
            item.dataset.size = ad.size;
            
            // Store dimensions for layout calculations
            const dims = this.getItemDimensions(ad);
            item.dataset.itemWidth = dims.width;
            item.dataset.itemHeight = dims.height;
            
            const img = document.createElement('img');
            img.src = ad.imageUrl;
            img.alt = ad.id;
            img.loading = 'lazy';
            
            item.appendChild(img);
            this.elements.gridWrapper.appendChild(item);
            this.itemElements.set(String(ad.id), item);  // Use string key
            
            // Click handler
            item.addEventListener('click', () => this.openDetail(ad));
        });
    }

    handleFilterChange(field, value, checked) {
        if (checked) {
            if (!this.activeFilters[field].includes(value)) {
                this.activeFilters[field].push(value);
            }
        } else {
            this.activeFilters[field] = this.activeFilters[field].filter(v => v !== value);
        }
        
        this.applyFilters();
    }

    applyFilters() {
        const allItems = Array.from(this.itemElements.values());
        
        // Determine which items match the filter
        const matchingIds = new Set();
        
        this.ads.forEach(ad => {
            let matches = true;
            
            Object.entries(this.activeFilters).forEach(([field, values]) => {
                if (values.length > 0 && !values.includes(ad[field])) {
                    matches = false;
                }
            });
            
            if (matches) {
                matchingIds.add(String(ad.id));  // Use string for consistency
            }
        });

        // Update filtered/visible ads
        this.filteredAds = this.ads.filter(ad => matchingIds.has(String(ad.id)));
        this.sortAds();
        
        // Auto-group by vertical when filtering by vertical
        if (this.activeFilters.vertical.length > 0 && !this.currentGroupBy) {
            this.currentGroupBy = 'vertical';
            this.elements.groupBy.value = 'vertical';
        } else if (this.activeFilters.vertical.length === 0 && this.elements.groupBy.value === 'vertical' && !this._userSetGroup) {
            this.currentGroupBy = '';
            this.elements.groupBy.value = '';
        }

        // Get items to show and hide (before marking)
        const toHide = [];
        
        allItems.forEach(item => {
            const isVisible = item.dataset.hidden !== 'true' && item.style.display !== 'none';
            const shouldBeVisible = matchingIds.has(item.dataset.id);
            
            if (!shouldBeVisible && isVisible) {
                toHide.push(item);
            }
        });

        // Mark items as hidden/visible
        allItems.forEach(item => {
            if (matchingIds.has(item.dataset.id)) {
                item.dataset.hidden = 'false';
                item.style.display = '';
                item.style.opacity = '1';
            } else {
                item.dataset.hidden = 'true';
            }
        });
        
        // Animate layout change
        if (toHide.length > 0) {
            this.animator.fadeOut(toHide, {
                duration: 250,
                onComplete: () => {
                    toHide.forEach(item => {
                        item.style.display = 'none';
                    });
                    this.animateLayoutChange();
                    // Delay fitToViewport to let animation complete
                    setTimeout(() => this.fitToViewport(), 100);
                }
            });
        } else {
            this.animateLayoutChange();
            // Delay fitToViewport to let animation complete
            setTimeout(() => this.fitToViewport(), 100);
        }

        this.updateCounts();
        this.updateViewTitle();
    }

    sortAds() {
        const field = this.currentSortBy;
        const order = this.currentSortOrder === 'asc' ? 1 : -1;
        
        this.filteredAds.sort((a, b) => {
            let valA = a[field] || '';
            let valB = b[field] || '';
            
            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * order;
            }
            return (valA - valB) * order;
        });
        
        this.visibleAds = [...this.filteredAds];
    }

    animateLayoutChange() {
        const visibleItems = Array.from(this.itemElements.values())
            .filter(item => item.dataset.hidden !== 'true');
        
        this.animator.flip(visibleItems, () => {
            this.applyLayout();
        }, {
            duration: 600,
            onComplete: () => {
                this.updateContainerSize();
                this.constrainPan();
                this.applyTransform();
            }
        });
    }

    applyLayout() {
        if (this.currentGroupBy) {
            this.applyGroupedLayout();
        } else {
            this.applyGridLayout();
        }
        this.updateContainerSize();
    }

    applyGridLayout() {
        // Clear any group labels
        this.elements.gridWrapper.querySelectorAll('.group-label').forEach(l => l.remove());
        
        const containerWidth = this.elements.gridContainer.clientWidth - this.padding * 2;
        const containerHeight = this.elements.gridContainer.clientHeight - this.padding * 2;
        
        // Get visible items
        const visibleItems = this.filteredAds.filter(ad => {
            const item = this.itemElements.get(String(ad.id));
            return item && item.dataset.hidden !== 'true';
        });
        const totalItems = visibleItems.length;
        if (totalItems === 0) return;
        
        // Calculate optimal cell size to fill the viewport
        // Find the best grid dimensions that fill the container
        let bestCellSize = 60;
        let bestCols = 1;
        let bestRows = 1;
        let bestFit = Infinity;
        
        // Try different column counts to find best fit
        for (let cols = 1; cols <= totalItems; cols++) {
            const rows = Math.ceil(totalItems / cols);
            
            // Calculate cell size that would fill the container
            const cellWidth = (containerWidth - (cols - 1) * this.itemGap) / cols;
            const cellHeight = (containerHeight - (rows - 1) * this.itemGap) / rows;
            const cellSize = Math.min(cellWidth, cellHeight);
            
            // Skip if cells would be too small or too large
            if (cellSize < 30 || cellSize > 200) continue;
            
            // Calculate how well this fills the container
            const gridWidth = cols * cellSize + (cols - 1) * this.itemGap;
            const gridHeight = rows * cellSize + (rows - 1) * this.itemGap;
            const wastedSpace = Math.abs(containerWidth - gridWidth) + Math.abs(containerHeight - gridHeight);
            
            if (wastedSpace < bestFit) {
                bestFit = wastedSpace;
                bestCellSize = cellSize;
                bestCols = cols;
                bestRows = rows;
            }
        }
        
        const cellSize = Math.floor(bestCellSize);
        const cols = bestCols;
        
        // Center the grid in the container
        const gridWidth = cols * cellSize + (cols - 1) * this.itemGap;
        const gridHeight = bestRows * cellSize + (bestRows - 1) * this.itemGap;
        const offsetX = Math.max(0, (containerWidth - gridWidth) / 2);
        const offsetY = Math.max(0, (containerHeight - gridHeight) / 2);
        
        // Position items in uniform grid
        visibleItems.forEach((ad, index) => {
            const item = this.itemElements.get(String(ad.id));
            if (!item) return;
            
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const x = offsetX + col * (cellSize + this.itemGap);
            const y = offsetY + row * (cellSize + this.itemGap);
            
            item.style.left = x + 'px';
            item.style.top = y + 'px';
            item.style.width = cellSize + 'px';
            item.style.height = cellSize + 'px';
        });
        
        // Update wrapper dimensions
        this.elements.gridWrapper.style.width = containerWidth + 'px';
        this.elements.gridWrapper.style.height = (offsetY + gridHeight + this.padding) + 'px';
    }

    applyGroupedLayout() {
        // Clear existing group labels
        this.elements.gridWrapper.querySelectorAll('.group-label').forEach(l => l.remove());
        
        // Group ads by field
        const groups = new Map();
        this.filteredAds.forEach(ad => {
            const key = ad[this.currentGroupBy] || 'Unknown';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(ad);
        });
        
        // Sort groups by name
        const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        
        // Calculate canvas dimensions for full-width distribution
        const canvasWidth = this.elements.gridContainer.clientWidth - this.padding * 2;
        const numGroups = sortedGroups.length;
        const labelHeight = 40;
        const labelMargin = 10;
        
        // Calculate column width for each group (evenly distributed)
        const columnWidth = Math.floor(canvasWidth / numGroups);
        
        // Use uniform cell size for grouped view (based on baseHeight, square-ish for compact stacking)
        const cellSize = this.baseHeight;
        
        // Find the tallest stack to align bottoms
        let maxStackHeight = 0;
        sortedGroups.forEach(([, groupAds]) => {
            const count = groupAds.length;
            // Use single column for stacked layout like original Pivot
            const cols = Math.max(1, Math.floor((columnWidth - this.blockGap) / (cellSize + this.itemGap)));
            const rows = Math.ceil(count / cols);
            const stackHeight = rows * (cellSize + this.itemGap);
            maxStackHeight = Math.max(maxStackHeight, stackHeight);
        });
        
        // Position each group
        sortedGroups.forEach(([category, groupAds], groupIndex) => {
            const count = groupAds.length;
            
            // Calculate column position (centered in allocated space)
            const groupCenterX = (groupIndex + 0.5) * columnWidth;
            
            // Calculate columns that fit in allocated width
            const availableWidth = columnWidth - this.blockGap;
            const cols = Math.max(1, Math.floor(availableWidth / (cellSize + this.itemGap)));
            const rows = Math.ceil(count / cols);
            
            const blockWidth = cols * (cellSize + this.itemGap) - this.itemGap;
            const blockHeight = rows * (cellSize + this.itemGap) - this.itemGap;
            
            // Center the block horizontally in its column
            const blockX = groupCenterX - blockWidth / 2;
            
            // Align stacks to bottom (with space for label below)
            const stackTopY = maxStackHeight - blockHeight;
            
            // Position items within block - use uniform cell size for stacks
            groupAds.forEach((ad, i) => {
                const item = this.itemElements.get(String(ad.id));
                if (!item || item.dataset.hidden === 'true') return;
                
                const col = i % cols;
                const row = Math.floor(i / cols);
                
                const x = blockX + col * (cellSize + this.itemGap);
                const y = stackTopY + row * (cellSize + this.itemGap);
                
                item.style.left = x + 'px';
                item.style.top = y + 'px';
                item.style.width = cellSize + 'px';
                item.style.height = cellSize + 'px';
            });
            
            // Add group label at BOTTOM of stack
            const label = document.createElement('div');
            label.className = 'group-label';
            label.innerHTML = `<span class="label-text">${category}</span><span class="label-count">${count}</span>`;
            label.style.left = (groupCenterX - 60) + 'px'; // Center the label
            label.style.top = (maxStackHeight + labelMargin) + 'px';
            label.style.width = '120px';
            this.elements.gridWrapper.appendChild(label);
        });
        
        // Update wrapper size
        this.elements.gridWrapper.style.width = canvasWidth + 'px';
        this.elements.gridWrapper.style.height = (maxStackHeight + labelHeight + labelMargin + this.padding) + 'px';
    }

    updateContainerSize() {
        const items = Array.from(this.itemElements.values())
            .filter(item => item.dataset.hidden !== 'true');
        
        if (items.length === 0) return;
        
        let maxX = 0;
        let maxY = 0;
        
        items.forEach(item => {
            const x = parseFloat(item.style.left) + parseFloat(item.style.width);
            const y = parseFloat(item.style.top) + parseFloat(item.style.height);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
        
        this.elements.gridWrapper.style.width = (maxX + this.padding) + 'px';
        this.elements.gridWrapper.style.height = (maxY + this.padding + 30) + 'px';
    }

    zoom(factor) {
        const oldScale = this.scale;
        this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
        
        // Zoom towards center of viewport
        const container = this.elements.gridContainer;
        const centerX = container.clientWidth / 2;
        const centerY = container.clientHeight / 2;
        
        // Adjust pan to keep center point stationary
        const scaleChange = this.scale / oldScale;
        this.panOffset.x = centerX - (centerX - this.panOffset.x) * scaleChange;
        this.panOffset.y = centerY - (centerY - this.panOffset.y) * scaleChange;
        
        this.constrainPan();
        this.applyTransform();
        this.elements.zoomLevel.textContent = Math.round(this.scale * 100) + '%';
    }
    
    applyTransform() {
        this.elements.gridWrapper.style.transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.scale})`;
    }
    
    resetPan() {
        this.panOffset = { x: 0, y: 0 };
        this.applyTransform();
    }
    
    constrainPan() {
        const container = this.elements.gridContainer;
        const wrapper = this.elements.gridWrapper;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const contentWidth = (parseFloat(wrapper.style.width) || wrapper.offsetWidth) * this.scale;
        const contentHeight = (parseFloat(wrapper.style.height) || wrapper.offsetHeight) * this.scale;
        
        // Calculate bounds - content should stay within viewport
        // Allow panning such that content edge doesn't go past container edge
        const minX = Math.min(0, containerWidth - contentWidth);
        const maxX = Math.max(0, containerWidth - contentWidth);
        const minY = Math.min(0, containerHeight - contentHeight);
        const maxY = Math.max(0, containerHeight - contentHeight);
        
        // If content fits in container, center it
        if (contentWidth <= containerWidth) {
            this.panOffset.x = (containerWidth - contentWidth) / 2;
        } else {
            this.panOffset.x = Math.max(minX, Math.min(maxX === 0 ? 0 : 0, this.panOffset.x));
            // Keep content from going too far left or right
            if (this.panOffset.x > 0) this.panOffset.x = 0;
            if (this.panOffset.x < containerWidth - contentWidth) {
                this.panOffset.x = containerWidth - contentWidth;
            }
        }
        
        if (contentHeight <= containerHeight) {
            this.panOffset.y = (containerHeight - contentHeight) / 2;
        } else {
            this.panOffset.y = Math.max(minY, Math.min(maxY === 0 ? 0 : 0, this.panOffset.y));
            // Keep content from going too far up or down
            if (this.panOffset.y > 0) this.panOffset.y = 0;
            if (this.panOffset.y < containerHeight - contentHeight) {
                this.panOffset.y = containerHeight - contentHeight;
            }
        }
    }

    fitToViewport() {
        const container = this.elements.gridContainer;
        const wrapper = this.elements.gridWrapper;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const contentWidth = parseFloat(wrapper.style.width) || wrapper.offsetWidth || containerWidth;
        const contentHeight = parseFloat(wrapper.style.height) || wrapper.offsetHeight || containerHeight;
        
        if (contentWidth === 0 || contentHeight === 0) {
            this.scale = 1;
        } else {
            // Scale to fit entire content in viewport with a bit of padding
            const padding = 40;
            const scaleX = (containerWidth - padding) / contentWidth;
            const scaleY = (containerHeight - padding) / contentHeight;
            // Use the smaller scale to ensure everything fits
            this.scale = Math.min(scaleX, scaleY);
        }
        
        // Clamp to valid range
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));
        
        // Center the content
        const scaledWidth = contentWidth * this.scale;
        const scaledHeight = contentHeight * this.scale;
        this.panOffset.x = (containerWidth - scaledWidth) / 2;
        this.panOffset.y = (containerHeight - scaledHeight) / 2;
        
        this.applyTransform();
        this.elements.zoomLevel.textContent = Math.round(this.scale * 100) + '%';
    }

    openDetail(ad) {
        this.selectedIndex = this.filteredAds.findIndex(a => a.id === ad.id);
        if (this.selectedIndex === -1) return;
        
        this.detailOpen = true;
        
        // Update detail panel content
        this.elements.detailImage.src = ad.imageUrl;
        this.elements.currentIndex.textContent = this.selectedIndex + 1;
        this.elements.filteredCount.textContent = this.filteredAds.length;
        
        // Build metadata
        const width = ad.dimensions?.width || ad.width || 'N/A';
        const height = ad.dimensions?.height || ad.height || 'N/A';
        
        this.elements.detailMeta.innerHTML = `
            <div class="meta-section">
                <h3>Ad Information</h3>
                <div class="meta-row">
                    <span class="meta-label">ID</span>
                    <span class="meta-value">${ad.id}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Filename</span>
                    <span class="meta-value">${ad.filename}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Size</span>
                    <span class="meta-value">${ad.size}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Dimensions</span>
                    <span class="meta-value">${width} × ${height}</span>
                </div>
            </div>
            <div class="meta-section">
                <h3>Classification</h3>
                <div class="meta-row">
                    <span class="meta-label">MSN Vertical</span>
                    <span class="meta-value">${ad.vertical}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Ad Type</span>
                    <span class="meta-value">${ad.adType || 'N/A'}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Brand Category</span>
                    <span class="meta-value">${ad.brand || 'N/A'}</span>
                </div>
            </div>
            <div class="meta-section">
                <h3>Performance</h3>
                <div class="meta-row">
                    <span class="meta-label">Rating</span>
                    <span class="meta-value rating-stars rating-${ad.rating || 0}">${ad.rating ? renderStars(ad.rating) : 'N/A'}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Status</span>
                    <span class="meta-value status-${(ad.status || '').toLowerCase()}">${ad.status || 'N/A'}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Impressions</span>
                    <span class="meta-value">${ad.impressions ? ad.impressions.toLocaleString() : 'N/A'}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">CTR</span>
                    <span class="meta-value">${ad.ctr || 'N/A'}</span>
                </div>
            </div>
        `;
        
        // Highlight selected item
        this.itemElements.forEach(item => item.classList.remove('selected'));
        const selectedItem = this.itemElements.get(String(ad.id));
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // Dim sidebar
        this.elements.sidebar.classList.add('dimmed');
        
        // Slide in panel
        this.animator.slideInRight(this.elements.detailPanel);
    }

    closeDetail() {
        if (!this.detailOpen) return;
        
        this.detailOpen = false;
        
        // Remove selection
        this.itemElements.forEach(item => item.classList.remove('selected'));
        
        // Restore sidebar
        this.elements.sidebar.classList.remove('dimmed');
        
        // Slide out panel
        this.animator.slideOutRight(this.elements.detailPanel);
    }

    navigateDetail(direction) {
        if (!this.detailOpen) return;
        
        this.selectedIndex += direction;
        
        // Wrap around
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.filteredAds.length - 1;
        } else if (this.selectedIndex >= this.filteredAds.length) {
            this.selectedIndex = 0;
        }
        
        const ad = this.filteredAds[this.selectedIndex];
        if (ad) {
            this.openDetail(ad);
        }
    }

    clearAllFilters() {
        // Uncheck all checkboxes
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        // Clear filter state
        Object.keys(this.activeFilters).forEach(key => {
            this.activeFilters[key] = [];
        });
        
        // Show all items
        this.filteredAds = [...this.ads];
        this.sortAds();
        
        // Fade in all hidden items
        const hiddenItems = Array.from(this.itemElements.values())
            .filter(item => item.dataset.hidden === 'true');
        
        if (hiddenItems.length > 0) {
            this.animator.fadeIn(hiddenItems, {
                duration: 200,
                onComplete: () => {
                    this.animateLayoutChange();
                }
            });
        } else {
            this.animateLayoutChange();
        }
        
        this.updateCounts();
        this.updateViewTitle();
    }

    updateCounts() {
        const visibleCount = this.filteredAds.length;
        const totalCount = this.ads.length;
        
        this.elements.visibleCount.textContent = visibleCount;
        this.elements.totalCount.textContent = totalCount;
    }

    updateViewTitle() {
        const activeFilters = [];
        
        Object.entries(this.activeFilters).forEach(([field, values]) => {
            if (values.length > 0) {
                activeFilters.push(values.join(', '));
            }
        });
        
        if (activeFilters.length > 0) {
            this.elements.viewTitle.textContent = activeFilters.join(' · ');
        } else {
            this.elements.viewTitle.textContent = 'All Ads';
        }
    }

    hideLoading() {
        this.elements.loading.classList.add('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.pivotApp = new PivotApp();
});
