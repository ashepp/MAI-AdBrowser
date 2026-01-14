// Ad Image Viewer Application
// Main application logic with OpenSeadragon integration

class AdViewer {
    constructor() {
        this.viewer = null;
        this.ads = [];
        this.filteredAds = [];
        this.currentLayout = 'grid'; // 'grid' or 'stacks'
        this.viewMode = 'grid'; // Start with grid view
        this.gridSpacing = 5;
        this.tileSources = [];
        this.comparisonMode = false;
        this.selectedAds = [];
        this.presentationMode = false;
        this.presentationInterval = null;
        this.isTransitioning = false;
        
        this.init();
    }

    async init() {
        console.log('Initializing AdViewer...');
        
        // Load ad data first (will use sample data if fetch fails)
        await this.loadAdData();
        
        console.log('Loaded', this.ads.length, 'ads, initializing viewer...');
        
        // Initialize OpenSeadragon viewer
        this.initViewer();
        
        // Populate filter options (must be done before setupFilters)
        this.populateFilterOptions();
        
        // Setup filters
        this.setupFilters();
        
        // Setup controls
        this.setupControls();
        
        // Initial render after everything is ready
        console.log('Applying filters and rendering...');
        this.applyFilters();
        
        // Hide loading indicator
        setTimeout(() => {
            const loading = document.getElementById('loading');
            if (loading) {
                loading.classList.add('hidden');
                console.log('Loading hidden');
            }
        }, 500);
    }

    async loadAdData() {
        try {
            const response = await fetch('data/ads.json');
            if (!response.ok) {
                throw new Error('Failed to load ads.json');
            }
            let loadedAds = await response.json();
            
            // Normalize ad data - ensure imageUrl exists (scraped ads use 'path')
            this.ads = loadedAds.map(ad => ({
                ...ad,
                imageUrl: ad.imageUrl || ad.path || `images/ads/${ad.filename}`
            }));
            this.filteredAds = [...this.ads];
            
            // Update stats
            this.updateStats();
            
            console.log(`Loaded ${this.ads.length} ads`);
        } catch (error) {
            console.error('Error loading ad data, using sample data:', error);
            // Use sample data if file not found (e.g., when opening file:// directly)
            this.loadSampleData();
        }
    }

    loadSampleData() {
        console.log('Loading sample data...');
        // Generate sample ad data for demonstration
        this.ads = this.generateSampleAds(1000);
        this.filteredAds = [...this.ads];
        console.log('Sample data loaded:', this.ads.length, 'ads');
        this.updateStats();
    }

    generateSampleAds(count) {
        const products = ['Copilot', 'Search', 'Browse', 'Discover', 'Shopping'];
        const sizes = ['300x250', '728x90', '160x600', '320x50', '970x250', '300x600'];
        const topics = ['AI & Technology', 'Productivity', 'E-commerce', 'News', 'Travel', 'Entertainment'];
        const types = ['Display', 'Video', 'Native', 'Sponsored'];
        const placements = ['Homepage', 'Search Results', 'News Feed', 'Sidebar', 'Article Footer', 'Between Content'];
        const issues = ['', '', '', 'Low CTR', 'High Bounce', 'Brand Mismatch', 'Quality Concern'];
        
        // Realistic ad headlines and CTAs by product
        const adContent = {
            'Copilot': [
                'Transform Your Workflow with AI',
                'Code Faster, Build Better',
                'Your AI Pair Programmer',
                'Boost Productivity 10x',
                'Write Better Code Today'
            ],
            'Search': [
                'Find Anything, Instantly',
                'Search Smarter, Not Harder',
                'Get Results That Matter',
                'The Answer Starts Here',
                'Discover More with AI Search'
            ],
            'Browse': [
                'Your Gateway to the Web',
                'Browse Safely & Privately',
                'Fast, Secure, Reliable',
                'Experience the Modern Web',
                'Browse Without Limits'
            ],
            'Discover': [
                'Explore What\'s Trending',
                'Personalized Just for You',
                'Discover Your Next Favorite',
                'Stay In The Know',
                'Content That Inspires'
            ],
            'Shopping': [
                'Shop Smarter, Save More',
                'Limited Time Offers',
                'Find the Best Deals',
                'Shop with Confidence',
                'Your One-Stop Shop'
            ]
        };
        
        console.log('Generating sample ads...');
        const ads = [];
        
        // Use locally downloaded images first, then unsplash for variety
        const useLocalImages = true;
        
        for (let i = 0; i < count; i++) {
            const size = sizes[i % sizes.length];
            const [width, height] = size.split('x');
            const product = products[i % products.length];
            const topic = topics[Math.floor(Math.random() * topics.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            const quality = Math.floor(Math.random() * 5) + 1;
            const placement = placements[Math.floor(Math.random() * placements.length)];
            const issue = quality < 3 ? issues[Math.floor(Math.random() * issues.length)] : '';
            const headline = adContent[product][Math.floor(Math.random() * adContent[product].length)];
            
            let imageUrl;
            
            // Use picsum.photos - reliable placeholder service
            if (useLocalImages && i < 30) {
                imageUrl = `images/ads/ad-${i + 1}.jpg`;
            } else {
                // Use picsum.photos with unique IDs - much more reliable than Unsplash Source
                const imageId = 100 + i;
                imageUrl = `https://picsum.photos/id/${imageId}/${width}/${height}`;
            }
            
            ads.push({
                id: `ad-${i + 1}`,
                title: `${product} - ${headline}`,
                headline: headline,
                product: product,
                size: size,
                topic: topic,
                type: type,
                quality: quality,
                imageUrl: imageUrl,
                description: `${product} ad campaign for ${topic}`,
                width: parseInt(width),
                height: parseInt(height),
                placement: placement,
                impressions: Math.floor(Math.random() * 1000000) + 10000,
                ctr: (Math.random() * 5).toFixed(2) + '%',
                issue: issue,
                isLowQuality: quality < 3
            });
        }
        console.log('Generated', ads.length, 'sample ads');
        return ads;
    }

    initViewer() {
        const loading = document.getElementById('loading');
        
        this.viewer = OpenSeadragon({
            id: 'openseadragon-viewer',
            prefixUrl: 'lib/openseadragon-bin-4.1.0/images/',
            showNavigationControl: false,
            showNavigator: true,
            navigatorPosition: 'BOTTOM_RIGHT',
            gestureSettingsMouse: {
                clickToZoom: false,
                dblClickToZoom: true,
                scrollToZoom: true,
                flickEnabled: true,
                flickMinSpeed: 40,
                flickMomentum: 0.3,
                dragToPan: true
            },
            gestureSettingsTouch: {
                pinchToZoom: true,
                flickEnabled: true,
                dragToPan: true
            },
            minZoomLevel: 0.05,
            maxZoomLevel: 10,
            visibilityRatio: 0.05,
            minZoomImageRatio: 0.5,
            maxZoomPixelRatio: 2,
            constrainDuringPan: false,
            wrapHorizontal: false,
            wrapVertical: false,
            animationTime: 1.2,
            springStiffness: 7,
            zoomPerScroll: 1.2,
            zoomPerClick: 1.0,
            homeFillsViewer: false,
            // Enable smooth tile transitions
            immediateRender: false,
            preload: true
        });

        // Handle viewer events
        this.viewer.addHandler('open', () => {
            loading.classList.add('hidden');
            console.log('Viewer opened successfully');
        });

        // Hide loading after viewer initializes
        setTimeout(() => {
            loading.classList.add('hidden');
        }, 1000);

        this.viewer.addHandler('canvas-click', (event) => {
            this.handleAdClick(event);
        });

        this.viewer.addHandler('canvas-drag', () => {
            this.hideInfoPanel();
        });
    }

    layoutAds() {
        console.log('layoutAds called, filteredAds:', this.filteredAds.length);
        
        const loadingEl = document.getElementById('loading');
        if (this.filteredAds.length === 0) {
            if (loadingEl) loadingEl.classList.add('hidden');
            return;
        }

        // Check if we should use grid or stacks based on filtering
        const selectedProducts = this.getCheckedValues('product');
        // Always use stacks if any filtering is active, grid for viewing all
        const hasProductFilter = selectedProducts.length > 0 && selectedProducts.length < 5;
        
        // Determine target layout
        const targetLayout = hasProductFilter ? 'stacks' : 'grid';
        
        // If we have existing tiles, animate them to new positions
        const existingItems = this.viewer.world.getItemCount();
        
        if (existingItems > 0) {
            this.animateToLayout(targetLayout);
        } else {
            // First time - just create the layout
            if (targetLayout === 'stacks') {
                this.layoutAsStacks();
            } else {
                this.layoutAsGrid();
            }
        }
    }

    animateToLayout(targetLayout) {
        console.log(`Animating to ${targetLayout} layout`);
        
        // Clear existing overlays (labels)
        this.viewer.clearOverlays();
        
        // Calculate new positions for all ads
        const layoutData = this.calculateLayout(targetLayout);
        const newPositions = layoutData.positions;
        const blocks = layoutData.blocks || [];
        
        // Create a map of ad IDs to their new positions
        const positionMap = new Map();
        this.filteredAds.forEach((ad, index) => {
            if (newPositions[index]) {
                positionMap.set(ad.id, newPositions[index]);
            }
        });
        
        // Animate existing tiles to new positions or fade out if not in filtered set
        const itemCount = this.viewer.world.getItemCount();
        for (let i = itemCount - 1; i >= 0; i--) {
            const item = this.viewer.world.getItemAt(i);
            const ad = item.userData;
            
            if (ad && positionMap.has(ad.id)) {
                // Animate to new position
                const newPos = positionMap.get(ad.id);
                item.setPosition(new OpenSeadragon.Point(newPos.x, newPos.y), true);
                item.setWidth(newPos.width, true);
                if (item.getOpacity() < 1) {
                    item.setOpacity(1);
                }
            } else {
                // Fade out and remove
                item.setOpacity(0);
                setTimeout(() => {
                    this.viewer.world.removeItem(item);
                }, 500);
            }
        }
        
        // Add any new items that don't exist yet
        this.filteredAds.forEach((ad, index) => {
            let found = false;
            for (let i = 0; i < this.viewer.world.getItemCount(); i++) {
                const item = this.viewer.world.getItemAt(i);
                if (item.userData && item.userData.id === ad.id) {
                    found = true;
                    break;
                }
            }
            
            if (!found && newPositions[index]) {
                const pos = newPositions[index];
                this.viewer.addSimpleImage({
                    url: ad.imageUrl,
                    x: pos.x,
                    y: pos.y,
                    width: pos.width,
                    opacity: 0,
                    userData: ad,
                    success: (event) => {
                        event.item.setOpacity(1);
                    }
                });
            }
        });
        
        // Fit viewport to show all items
        setTimeout(() => {
            this.fitViewportToData(targetLayout);
        }, 100);
    }

    calculateLayout(layoutType) {
        const positions = [];
        const blocks = []; // Store block metadata for labels
        
        if (layoutType === 'grid') {
            const totalAds = this.filteredAds.length;
            const cols = Math.ceil(Math.sqrt(totalAds * 1.3));
            const itemSize = 0.04;
            const gap = 0.002;
            const spacing = itemSize + gap;
            
            this.filteredAds.forEach((ad, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                positions.push({
                    x: col * spacing,
                    y: row * spacing,
                    width: itemSize
                });
            });
        } else {
            // Stacks layout - create rectangular blocks/clusters like Pivot
            const groupedAds = {};
            this.filteredAds.forEach(ad => {
                if (!groupedAds[ad.product]) groupedAds[ad.product] = [];
                groupedAds[ad.product].push(ad);
            });
            
            const itemSize = 0.04;
            const gap = 0.002;
            const spacing = itemSize + gap;
            const groupGap = 0.10; // Larger gap between product groups
            
            const products = Object.keys(groupedAds).sort();
            let currentX = 0;
            
            products.forEach(product => {
                const productAds = groupedAds[product];
                const itemsInGroup = productAds.length;
                
                // PRD Block Dimension Algorithm
                let cols;
                if (itemsInGroup <= 20) {
                    cols = Math.ceil(Math.sqrt(itemsInGroup * 2.0)); // Wider rectangles for small groups
                } else if (itemsInGroup <= 100) {
                    cols = Math.ceil(Math.sqrt(itemsInGroup * 1.5)); // Balanced rectangles
                } else {
                    cols = Math.ceil(Math.sqrt(itemsInGroup * 1.2)); // Taller rectangles for large groups
                }
                
                const rows = Math.ceil(itemsInGroup / cols);
                const blockWidth = cols * spacing - gap;
                const blockHeight = rows * spacing - gap;
                
                // Store block metadata for label placement
                blocks.push({
                    category: product,
                    x: currentX,
                    y: 0,
                    width: blockWidth,
                    height: blockHeight,
                    count: itemsInGroup
                });
                
                productAds.forEach((ad, index) => {
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    
                    const adIndex = this.filteredAds.indexOf(ad);
                    if (adIndex !== -1) {
                        positions[adIndex] = {
                            x: currentX + (col * spacing),
                            y: row * spacing,
                            width: itemSize
                        };
                    }
                });
                
                // Move to next group position
                currentX += blockWidth + groupGap;
            });
        }
        
        return { positions, blocks };
    }

    fitViewportToData(layoutType) {
        const layoutData = this.calculateLayout(layoutType);
        const positions = layoutData.positions;
        const blocks = layoutData.blocks || [];
        
        if (positions.length === 0) return;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + pos.width);
            maxY = Math.max(maxY, pos.y + pos.width);
        });
        
        // Add category labels for stacks view
        if (layoutType === 'stacks' && blocks.length > 0) {
            blocks.forEach(block => {
                this.addBlockLabel(block);
            });
            // Extend maxY to include label space
            maxY += 0.03;
        }
        
        const padding = 0.05;
        const bounds = new OpenSeadragon.Rect(
            minX - padding,
            minY - padding,
            (maxX - minX) + padding * 2,
            (maxY - minY) + padding * 2
        );
        
        this.viewer.viewport.fitBounds(bounds, true);
        
        const viewerElement = document.getElementById('openseadragon-viewer');
        if (viewerElement) viewerElement.style.opacity = '1';
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.classList.add('hidden');
    }

    layoutAsGrid() {
        console.log('Laying out as GRID');
        const viewerElement = document.getElementById('openseadragon-viewer');
        if (!viewerElement) {
            console.error('Viewer element not found');
            return;
        }
        
        this.viewer.world.removeAll();
        
        // Square grid layout - calculate optimal dimensions
        const totalAds = this.filteredAds.length;
        const cols = Math.ceil(Math.sqrt(totalAds * 1.3)); // Slightly wider
        const rows = Math.ceil(totalAds / cols);
        
        const itemSize = 0.04;
        const gap = 0.002; // Small gap between images
        const spacing = itemSize + gap;
        
        let addedCount = 0;
        
        console.log(`Grid: ${cols} cols x ${rows} rows for ${totalAds} ads`);
        
        this.filteredAds.forEach((ad, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            this.viewer.addSimpleImage({
                url: ad.imageUrl,
                x: col * spacing,
                y: row * spacing,
                width: itemSize,
                opacity: 0,
                userData: ad,
                success: (event) => {
                    addedCount++;
                    const tiledImage = event.item;
                    setTimeout(() => {
                        tiledImage.setOpacity(1);
                    }, Math.min(index * 2, 1000));
                    
                    if (addedCount === totalAds) {
                        const bounds = new OpenSeadragon.Rect(-0.05, -0.05, cols * spacing + 0.1, rows * spacing + 0.1);
                        this.viewer.viewport.fitBounds(bounds, true);
                        viewerElement.style.opacity = '1';
                        const loadingEl = document.getElementById('loading');
                        if (loadingEl) loadingEl.classList.add('hidden');
                        console.log(`Grid complete: ${addedCount} ads`);
                    }
                },
                error: () => {
                    addedCount++;
                    if (addedCount === totalAds) {
                        const bounds = new OpenSeadragon.Rect(-0.05, -0.05, cols * spacing + 0.1, rows * spacing + 0.1);
                        this.viewer.viewport.fitBounds(bounds, true);
                        viewerElement.style.opacity = '1';
                        const loadingEl = document.getElementById('loading');
                        if (loadingEl) loadingEl.classList.add('hidden');
                    }
                }
            });
        });
    }

    layoutAsStacks() {
        console.log('Laying out as STACKS (rectangular blocks)');
        const viewerElement = document.getElementById('openseadragon-viewer');
        
        this.viewer.world.removeAll();
        
        // Use calculateLayout to get positions and block metadata
        const layoutData = this.calculateLayout('stacks');
        const positions = layoutData.positions;
        const blocks = layoutData.blocks;
        
        let addedCount = 0;
        const totalAds = this.filteredAds.length;
        
        console.log(`Stacks: ${blocks.length} blocks:`, blocks.map(b => `${b.category}(${b.count})`).join(', '));
        
        this.filteredAds.forEach((ad, index) => {
            const pos = positions[index];
            if (!pos) return;
            
            this.viewer.addSimpleImage({
                url: ad.imageUrl,
                x: pos.x,
                y: pos.y,
                width: pos.width,
                opacity: 0,
                userData: ad,
                success: (event) => {
                    addedCount++;
                    const tiledImage = event.item;
                    // Staggered fade-in
                    setTimeout(() => {
                        tiledImage.setOpacity(1);
                    }, Math.min(index * 3, 1000));
                    
                    if (addedCount === totalAds) {
                        // Add block labels
                        blocks.forEach(block => {
                            this.addBlockLabel(block);
                        });
                        
                        // Fit viewport
                        this.fitViewportToData('stacks');
                        viewerElement.style.opacity = '1';
                        const loadingEl = document.getElementById('loading');
                        if (loadingEl) loadingEl.classList.add('hidden');
                        console.log(`Stacks complete: ${addedCount} ads in ${blocks.length} blocks`);
                    }
                },
                error: () => {
                    addedCount++;
                    if (addedCount === totalAds) {
                        blocks.forEach(block => {
                            this.addBlockLabel(block);
                        });
                        this.fitViewportToData('stacks');
                        viewerElement.style.opacity = '1';
                        const loadingEl = document.getElementById('loading');
                        if (loadingEl) loadingEl.classList.add('hidden');
                    }
                }
            });
        });
    }

    addBlockLabel(block) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'column-label';
        labelDiv.innerHTML = `
            <div class="label-text">${block.category}</div>
            <div class="label-count">(${block.count})</div>
        `;
        
        // Position label below the center of the block
        const labelY = block.y + block.height + 0.005;
        const labelX = block.x + (block.width / 2) - 0.04; // Center the label
        
        this.viewer.addOverlay({
            element: labelDiv,
            location: new OpenSeadragon.Point(labelX, labelY),
            placement: OpenSeadragon.Placement.TOP_LEFT
        });
    }

    handleAdClick(event) {
        if (!event.quick) return; // Only handle clicks, not drags
        
        const webPoint = event.position;
        const viewportPoint = this.viewer.viewport.pointFromPixel(webPoint);
        
        // Find which ad was clicked
        const itemCount = this.viewer.world.getItemCount();
        for (let i = 0; i < itemCount; i++) {
            const item = this.viewer.world.getItemAt(i);
            const bounds = item.getBounds();
            
            if (bounds.containsPoint(viewportPoint)) {
                const ad = item.userData;
                
                // Handle comparison mode
                if (this.comparisonMode) {
                    this.handleComparisonClick(ad);
                } else {
                    this.showAdInfo(ad);
                }
                break;
            }
        }
    }

    handleComparisonClick(ad) {
        const index = this.selectedAds.findIndex(a => a.id === ad.id);
        
        if (index > -1) {
            // Deselect
            this.selectedAds.splice(index, 1);
        } else {
            // Select (max 4)
            if (this.selectedAds.length < 4) {
                this.selectedAds.push(ad);
            } else {
                alert('Maximum 4 ads can be compared at once.');
                return;
            }
        }
        
        this.showComparisonView();
    }

    showComparisonView() {
        if (this.selectedAds.length === 0) {
            this.hideInfoPanel();
            return;
        }

        const infoPanel = document.getElementById('info-panel');
        const infoTitle = document.getElementById('info-title');
        const infoContent = document.getElementById('info-content');
        
        infoTitle.textContent = `Comparing ${this.selectedAds.length} Ads`;
        
        let html = '<div style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;\">';
        
        this.selectedAds.forEach(ad => {
            html += `
                <div style=\"border: 2px solid var(--primary-color); border-radius: 4px; padding: 8px; background: var(--background);\">
                    <strong>${ad.title}</strong><br>
                    <small>Product: ${ad.product}</small><br>
                    <small>Size: ${ad.size}</small><br>
                    <small>Quality: ${'⭐'.repeat(ad.quality)}</small>
                </div>
            `;
        });
        
        html += '</div>';
        infoContent.innerHTML = html;
        infoPanel.classList.remove('hidden');
    }

    showAdInfo(ad) {
        const sidebar = document.getElementById('detail-sidebar');
        const content = document.getElementById('detail-content');
        
        const qualityStars = '⭐'.repeat(ad.quality) + '☆'.repeat(5-ad.quality);
        const issueWarning = ad.issue ? `<div class="detail-issue">⚠ ${ad.issue}</div>` : '';
        
        content.innerHTML = `
            <div class="detail-header">
                <h3>${ad.product}</h3>
                <button class="close-detail" onclick="document.getElementById('detail-sidebar').classList.remove('visible')">&times;</button>
            </div>
            <div class="detail-image">
                <img src="${ad.imageUrl}" alt="${ad.title}" />
            </div>
            <div class="detail-body">
                <h4>${ad.headline}</h4>
                <div class="detail-row"><strong>Size:</strong> ${ad.size}</div>
                <div class="detail-row"><strong>Topic:</strong> ${ad.topic}</div>
                <div class="detail-row"><strong>Type:</strong> ${ad.type}</div>
                <div class="detail-row"><strong>Quality:</strong> ${qualityStars} ${ad.quality}/5</div>
                <div class="detail-row"><strong>Placement:</strong> ${ad.placement}</div>
                <div class="detail-row"><strong>Impressions:</strong> ${ad.impressions.toLocaleString()}</div>
                <div class="detail-row"><strong>CTR:</strong> ${ad.ctr}%</div>
                ${issueWarning}
            </div>
        `;
        
        sidebar.classList.add('visible');
    }

    hideInfoPanel() {
        const infoPanel = document.getElementById('info-panel');
        infoPanel.classList.add('hidden');
    }

    setupFilters() {
        // Add event listeners to quality checkboxes
        const qualityCheckboxes = document.querySelectorAll('input[name="quality"]');
        qualityCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => this.applyFilters());
        });
        
        // Problem ads checkbox
        const problemsCheckbox = document.getElementById('show-problems-only');
        if (problemsCheckbox) {
            problemsCheckbox.addEventListener('change', () => this.applyFilters());
        }
    }

    populateFilterOptions() {
        console.log('populateFilterOptions called with', this.ads.length, 'ads');
        
        // Get unique values for each filter
        const products = [...new Set(this.ads.map(ad => ad.product))].sort();
        const sizes = [...new Set(this.ads.map(ad => ad.size))].sort();
        const topics = [...new Set(this.ads.map(ad => ad.topic))].sort();
        const types = [...new Set(this.ads.map(ad => ad.type))].sort();

        console.log('Products:', products);
        console.log('Sizes:', sizes);
        
        // Populate checkbox filters
        this.populateCheckboxFilter('product-options', products, 'product');
        this.populateCheckboxFilter('size-options', sizes, 'size');
        this.populateCheckboxFilter('topic-options', topics, 'topic');
        this.populateCheckboxFilter('type-options', types, 'type');
        
        // Update quality counts
        this.updateQualityCounts();
        
        // Update issues count
        const issuesCount = this.ads.filter(ad => ad.issue).length;
        const issuesEl = document.getElementById('issues-count');
        if (issuesEl) issuesEl.textContent = issuesCount;
        
        console.log('Filter options populated');
    }

    populateCheckboxFilter(containerId, options, fieldName) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }
        
        container.innerHTML = '';

        // Calculate counts
        const counts = {};
        options.forEach(option => {
            counts[option] = this.ads.filter(ad => ad[fieldName] === option).length;
        });
        
        // Sort by count descending (Pivot behavior)
        options.sort((a, b) => counts[b] - counts[a]);

        options.forEach(option => {
            const count = counts[option];
            
            const label = document.createElement('label');
            label.className = 'filter-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = fieldName;
            checkbox.value = option;
            checkbox.addEventListener('change', () => this.applyFilters());
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'checkbox-label';
            labelSpan.textContent = option;
            
            const countSpan = document.createElement('span');
            countSpan.className = 'checkbox-count';
            countSpan.textContent = count;
            
            label.appendChild(checkbox);
            label.appendChild(labelSpan);
            label.appendChild(countSpan);
            
            container.appendChild(label);
        });
    }
    
    updateQualityCounts() {
        for (let i = 1; i <= 5; i++) {
            const count = this.ads.filter(ad => ad.quality === i).length;
            const countEl = document.querySelector(`.checkbox-count[data-value="${i}"]`);
            if (countEl) countEl.textContent = count;
        }
    }

    applyFilters() {
        // Get checked values from checkbox filters
        const products = this.getCheckedValues('product');
        const sizes = this.getCheckedValues('size');
        const topics = this.getCheckedValues('topic');
        const types = this.getCheckedValues('type');
        const qualities = this.getCheckedValues('quality');
        const problemsOnly = document.getElementById('show-problems-only')?.checked || false;

        this.filteredAds = this.ads.filter(ad => {
            // Product filter
            if (products.length && !products.includes(ad.product)) {
                return false;
            }

            // Size filter
            if (sizes.length && !sizes.includes(ad.size)) {
                return false;
            }

            // Topic filter
            if (topics.length && !topics.includes(ad.topic)) {
                return false;
            }

            // Type filter
            if (types.length && !types.includes(ad.type)) {
                return false;
            }

            // Quality filter
            if (qualities.length && !qualities.includes(ad.quality.toString())) {
                return false;
            }

            // Problem ads only filter
            if (problemsOnly && !ad.issue) {
                return false;
            }

            return true;
        });

        this.updateStats();
        this.layoutAds();
    }

    getCheckedValues(name) {
        const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }

    resetFilters() {
        // Uncheck all filter checkboxes
        document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        this.applyFilters();
    }

    updateStats() {
        // Update visible count in canvas header
        const visibleCount = document.getElementById('visible-count');
        if (visibleCount) {
            visibleCount.textContent = this.filteredAds.length;
        }
    }

    setupControls() {
        // Home button (toolbar)
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.viewer.viewport.goHome();
            });
        }

        // Clear all button
        const clearAllBtn = document.getElementById('clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }

        // Sample Ads Modal
        this.setupSampleAdsModal();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return; // Don't intercept when typing
            
            switch(e.key) {
                case '+':
                case '=':
                    this.viewer.viewport.zoomBy(1.5);
                    e.preventDefault();
                    break;
                case '-':
                case '_':
                    this.viewer.viewport.zoomBy(0.67);
                    e.preventDefault();
                    break;
                case 'Home':
                    this.viewer.viewport.goHome();
                    e.preventDefault();
                    break;
                case 'Escape':
                    if (this.viewer.isFullPage()) {
                        this.viewer.setFullScreen(false);
                    }
                    // Close modal on escape
                    this.closeSampleAdsModal();
                    break;
            }
        });
    }

    setupSampleAdsModal() {
        const modal = document.getElementById('sample-ads-modal');
        const openBtn = document.getElementById('get-sample-ads-btn');
        const closeBtn = document.getElementById('modal-close');
        const cancelBtn = document.getElementById('modal-cancel');
        const backdrop = modal?.querySelector('.modal-backdrop');
        const generateBtn = document.getElementById('generate-load-btn');
        const exportBtn = document.getElementById('export-json-btn');
        const sampleSize = document.getElementById('sample-size');
        const productCheckboxes = document.querySelectorAll('input[name="sample-product"]');

        if (!modal || !openBtn) return;

        // Open modal
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            this.updateSamplePreview();
        });

        // Close modal handlers
        const closeModal = () => modal.classList.add('hidden');
        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        backdrop?.addEventListener('click', closeModal);

        // Update preview when options change
        sampleSize?.addEventListener('change', () => this.updateSamplePreview());
        productCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => this.updateSamplePreview());
        });

        // Generate & Load button
        generateBtn?.addEventListener('click', () => this.generateAndLoadSampleAds());

        // Export JSON button
        exportBtn?.addEventListener('click', () => this.exportSampleAdsJSON());
    }

    closeSampleAdsModal() {
        const modal = document.getElementById('sample-ads-modal');
        if (modal) modal.classList.add('hidden');
    }

    updateSamplePreview() {
        const sampleSize = parseInt(document.getElementById('sample-size')?.value || 1000);
        const productCheckboxes = document.querySelectorAll('input[name="sample-product"]:checked');
        const totalCount = sampleSize * productCheckboxes.length;
        
        const previewEl = document.getElementById('total-preview');
        if (previewEl) {
            previewEl.textContent = totalCount.toLocaleString();
        }
    }

    getSampleOptions() {
        const sampleSize = parseInt(document.getElementById('sample-size')?.value || 1000);
        const method = document.getElementById('sample-method')?.value || 'random';
        const products = Array.from(document.querySelectorAll('input[name="sample-product"]:checked'))
            .map(cb => cb.value);
        
        return { sampleSize, method, products };
    }

    async generateAndLoadSampleAds() {
        const options = this.getSampleOptions();
        const progressContainer = document.getElementById('sample-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (options.products.length === 0) {
            alert('Please select at least one product.');
            return;
        }

        // Disable buttons during generation
        const generateBtn = document.getElementById('generate-load-btn');
        const exportBtn = document.getElementById('export-json-btn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
        }
        if (exportBtn) exportBtn.disabled = true;

        // Show progress immediately
        progressContainer?.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Starting generation...';

        const allAds = [];
        const totalProducts = options.products.length;

        for (let i = 0; i < options.products.length; i++) {
            const product = options.products[i];
            progressText.textContent = `Generating ${product} ads... (${i + 1}/${totalProducts})`;
            progressFill.style.width = `${((i) / totalProducts) * 100}%`;

            // Generate ads for this product
            const productAds = this.generateRealProductAds(product, options.sampleSize, options.method);
            allAds.push(...productAds);

            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        progressFill.style.width = '100%';
        progressText.textContent = `Loading ${allAds.length.toLocaleString()} ads...`;

        // Load the generated ads
        this.ads = allAds;
        this.filteredAds = [...this.ads];
        
        // Re-populate filters and render
        this.populateFilterOptions();
        this.updateStats();
        this.applyFilters();

        // Re-enable buttons
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate & Load';
        }
        if (exportBtn) exportBtn.disabled = false;

        // Show success message briefly
        progressText.textContent = `✓ Successfully loaded ${allAds.length.toLocaleString()} ads!`;
        progressFill.style.background = '#107c10';

        // Hide progress and close modal
        setTimeout(() => {
            progressContainer?.classList.add('hidden');
            progressFill.style.background = '';
            this.closeSampleAdsModal();
        }, 1500);

        console.log(`Generated and loaded ${allAds.length} sample ads`);
    }

    generateRealProductAds(product, count, method) {
        const sizes = ['300x250', '728x90', '160x600', '320x50', '970x250', '300x600', '336x280', '250x250'];
        const topics = ['AI & Technology', 'Productivity', 'E-commerce', 'News', 'Travel', 'Entertainment', 'Finance', 'Health'];
        const types = ['Display', 'Video', 'Native', 'Sponsored'];
        const placements = ['Homepage', 'Search Results', 'News Feed', 'Sidebar', 'Article Footer', 'Between Content'];
        const issues = ['', '', '', '', 'Low CTR', 'High Bounce', 'Brand Mismatch', 'Quality Concern'];

        // Product-specific headlines and themes
        const productContent = {
            'Copilot': {
                headlines: [
                    'Transform Your Workflow with AI',
                    'Code Faster, Build Better',
                    'Your AI Pair Programmer',
                    'Boost Productivity 10x',
                    'Write Better Code Today',
                    'AI-Powered Development',
                    'Ship Code Faster',
                    'Intelligent Code Completion'
                ],
                colorScheme: ['0078d4', '106ebe', '005a9e', '50e6ff'],
                theme: 'Development'
            },
            'Search': {
                headlines: [
                    'Find Anything, Instantly',
                    'Search Smarter, Not Harder',
                    'Get Results That Matter',
                    'The Answer Starts Here',
                    'Discover More with AI Search',
                    'Intelligent Search Results',
                    'Find What You Need',
                    'Search Reimagined'
                ],
                colorScheme: ['00a2ed', '0078d4', '243a5e', '50e6ff'],
                theme: 'Discovery'
            },
            'Browse': {
                headlines: [
                    'Your Gateway to the Web',
                    'Browse Safely & Privately',
                    'Fast, Secure, Reliable',
                    'Experience the Modern Web',
                    'Browse Without Limits',
                    'Privacy-First Browsing',
                    'Speed Meets Security',
                    'The Smarter Browser'
                ],
                colorScheme: ['107c10', '00a2ed', '0078d4', '50e6ff'],
                theme: 'Web'
            },
            'Discover': {
                headlines: [
                    'Explore What\'s Trending',
                    'Personalized Just for You',
                    'Discover Your Next Favorite',
                    'Stay In The Know',
                    'Content That Inspires',
                    'Curated For You',
                    'Never Miss a Trend',
                    'Your Daily Digest'
                ],
                colorScheme: ['e74856', 'ff8c00', '0078d4', 'ffb900'],
                theme: 'Content'
            },
            'Shopping': {
                headlines: [
                    'Shop Smarter, Save More',
                    'Limited Time Offers',
                    'Find the Best Deals',
                    'Shop with Confidence',
                    'Your One-Stop Shop',
                    'Unbeatable Prices',
                    'Deals You\'ll Love',
                    'Smart Shopping Starts Here'
                ],
                colorScheme: ['107c10', 'ffb900', 'e74856', '0078d4'],
                theme: 'Retail'
            }
        };

        const content = productContent[product] || productContent['Copilot'];
        const ads = [];

        // For stratified sampling, calculate distribution
        let distribution = {};
        if (method === 'stratified-topic') {
            const perTopic = Math.floor(count / topics.length);
            topics.forEach(topic => distribution[topic] = perTopic);
        } else if (method === 'stratified-size') {
            const perSize = Math.floor(count / sizes.length);
            sizes.forEach(size => distribution[size] = perSize);
        } else if (method === 'stratified-type') {
            const perType = Math.floor(count / types.length);
            types.forEach(type => distribution[type] = perType);
        }

        for (let i = 0; i < count; i++) {
            let size, topic, type;

            if (method === 'stratified-topic') {
                // Pick topic based on remaining distribution
                const availableTopics = Object.entries(distribution).filter(([_, remaining]) => remaining > 0);
                const [selectedTopic] = availableTopics[i % availableTopics.length];
                topic = selectedTopic;
                distribution[topic]--;
                size = sizes[Math.floor(Math.random() * sizes.length)];
                type = types[Math.floor(Math.random() * types.length)];
            } else if (method === 'stratified-size') {
                const availableSizes = Object.entries(distribution).filter(([_, remaining]) => remaining > 0);
                const [selectedSize] = availableSizes[i % availableSizes.length];
                size = selectedSize;
                distribution[size]--;
                topic = topics[Math.floor(Math.random() * topics.length)];
                type = types[Math.floor(Math.random() * types.length)];
            } else if (method === 'stratified-type') {
                const availableTypes = Object.entries(distribution).filter(([_, remaining]) => remaining > 0);
                const [selectedType] = availableTypes[i % availableTypes.length];
                type = selectedType;
                distribution[type]--;
                size = sizes[Math.floor(Math.random() * sizes.length)];
                topic = topics[Math.floor(Math.random() * topics.length)];
            } else {
                // Random selection
                size = sizes[Math.floor(Math.random() * sizes.length)];
                topic = topics[Math.floor(Math.random() * topics.length)];
                type = types[Math.floor(Math.random() * types.length)];
            }

            const [width, height] = size.split('x').map(Number);
            const quality = Math.floor(Math.random() * 5) + 1;
            const headline = content.headlines[Math.floor(Math.random() * content.headlines.length)];
            const color = content.colorScheme[Math.floor(Math.random() * content.colorScheme.length)];
            const placement = placements[Math.floor(Math.random() * placements.length)];
            const issue = quality < 3 ? issues[Math.floor(Math.random() * issues.length)] : '';

            // Generate realistic-looking ad image URL using placeholder service
            const imageId = Math.floor(Math.random() * 1000) + 1;
            const imageUrl = `https://picsum.photos/seed/${product.toLowerCase()}-${i}-${imageId}/${width}/${height}`;

            ads.push({
                id: `${product.toLowerCase()}-${i + 1}`,
                title: `${product} - ${headline}`,
                headline: headline,
                product: product,
                size: size,
                topic: topic,
                type: type,
                quality: quality,
                imageUrl: imageUrl,
                description: `${product} ad campaign for ${topic} - ${content.theme}`,
                width: width,
                height: height,
                placement: placement,
                impressions: Math.floor(Math.random() * 1000000) + 10000,
                ctr: (Math.random() * 5).toFixed(2) + '%',
                issue: issue,
                isLowQuality: quality < 3,
                theme: content.theme,
                colorScheme: color
            });
        }

        return ads;
    }

    async exportSampleAdsJSON() {
        const options = this.getSampleOptions();
        
        if (options.products.length === 0) {
            alert('Please select at least one product.');
            return;
        }

        const progressContainer = document.getElementById('sample-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        // Show progress
        progressContainer?.classList.remove('hidden');
        progressFill.style.width = '0%';

        const allAds = [];
        const productCounts = {};
        const totalProducts = options.products.length;

        for (let i = 0; i < options.products.length; i++) {
            const product = options.products[i];
            progressText.textContent = `Generating ${product} ads... (${i + 1}/${totalProducts})`;
            progressFill.style.width = `${((i) / totalProducts) * 100}%`;

            const productAds = this.generateRealProductAds(product, options.sampleSize, options.method);
            allAds.push(...productAds);
            productCounts[product] = productAds.length;

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        progressFill.style.width = '100%';
        progressText.textContent = 'Preparing JSON export...';

        // Create manifest
        const manifest = {
            exportDate: new Date().toISOString(),
            totalAds: allAds.length,
            sampleSize: options.sampleSize,
            sampleMethod: options.method,
            products: productCounts,
            ads: allAds
        };

        // Download as JSON
        const jsonString = JSON.stringify(manifest, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `sample-ads-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Hide progress
        setTimeout(() => {
            progressContainer?.classList.add('hidden');
        }, 500);

        console.log(`Exported ${allAds.length} ads to JSON`);
    }

    setViewMode(mode) {
        this.currentLayout = mode;
        
        // Update button states
        document.getElementById('grid-view').classList.toggle('active', mode === 'grid');
        document.getElementById('compact-view').classList.toggle('active', mode === 'compact');
        
        // Adjust spacing - tighter values for pivot table feel
        this.gridSpacing = mode === 'grid' ? 5 : 2;
        this.layoutAds();
    }

    // Add metadata overlay to ad image
    addAdOverlay(tiledImage, ad) {
        const bounds = tiledImage.getBounds();
        const element = document.createElement('div');
        element.className = 'ad-overlay';
        
        const qualityClass = ad.quality < 3 ? 'quality-low' : ad.quality >= 4 ? 'quality-high' : 'quality-medium';
        const issueTag = ad.issue ? `<span class="issue-tag">⚠️ ${ad.issue}</span>` : '';
        
        element.innerHTML = `
            <div class="ad-badge ${qualityClass}">
                <strong>${ad.product}</strong>
                <div class="headline-text">${ad.headline}</div>
                <span>${ad.size}</span>
                <span class="quality-stars">${'★'.repeat(ad.quality)}${'☆'.repeat(5-ad.quality)}</span>
                ${issueTag}
            </div>
        `;
        
        this.viewer.addOverlay({
            element: element,
            location: new OpenSeadragon.Rect(bounds.x, bounds.y, bounds.width, bounds.height)
        });
    }

    // Export filtered results as CSV
    exportResults() {
        const headers = ['ID', 'Title', 'Product', 'Size', 'Topic', 'Type', 'Quality'];
        const rows = this.filteredAds.map(ad => [
            ad.id,
            ad.title,
            ad.product,
            ad.size,
            ad.topic,
            ad.type,
            ad.quality
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ad-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        console.log(`Exported ${this.filteredAds.length} ads`);
    }

    // Toggle comparison mode
    toggleComparisonMode() {
        this.comparisonMode = !this.comparisonMode;
        const btn = document.getElementById('comparison-btn');
        
        if (this.comparisonMode) {
            btn.textContent = '✓ Compare Mode';
            btn.classList.add('active');
            this.selectedAds = [];
            alert('Comparison mode enabled. Click ads to select them for comparison (max 4).');
        } else {
            btn.textContent = '🔍 Compare Mode';
            btn.classList.remove('active');
            this.selectedAds = [];
            this.hideInfoPanel();
        }
    }

    // Toggle presentation mode
    togglePresentationMode() {
        this.presentationMode = !this.presentationMode;
        const btn = document.getElementById('presentation-btn');
        
        if (this.presentationMode) {
            btn.textContent = '⏸️ Stop';
            btn.classList.add('active');
            this.startPresentation();
        } else {
            btn.textContent = '▶️ Presentation';
            btn.classList.remove('active');
            this.stopPresentation();
        }
    }

    startPresentation() {
        if (this.filteredAds.length === 0) return;
        
        let currentIndex = 0;
        this.presentationInterval = setInterval(() => {
            const ad = this.filteredAds[currentIndex];
            this.showAdInfo(ad);
            
            // Zoom to the ad
            const itemCount = this.viewer.world.getItemCount();
            for (let i = 0; i < itemCount; i++) {
                const item = this.viewer.world.getItemAt(i);
                if (item.userData && item.userData.id === ad.id) {
                    const bounds = item.getBounds();
                    this.viewer.viewport.fitBounds(bounds.times(1.5), true);
                    break;
                }
            }
            
            currentIndex = (currentIndex + 1) % this.filteredAds.length;
        }, 3000); // Change ad every 3 seconds
    }

    stopPresentation() {
        if (this.presentationInterval) {
            clearInterval(this.presentationInterval);
            this.presentationInterval = null;
        }
        this.viewer.viewport.goHome();
        this.hideInfoPanel();
    }

    // Share current view
    shareView() {
        const params = new URLSearchParams();
        
        // Add filters to URL
        const search = document.getElementById('search').value;
        if (search) params.set('search', search);
        
        const products = this.getSelectedValues('product-filter');
        if (products.length) params.set('products', products.join(','));
        
        const sizes = this.getSelectedValues('size-filter');
        if (sizes.length) params.set('sizes', sizes.join(','));
        
        const topics = this.getSelectedValues('topic-filter');
        if (topics.length) params.set('topics', topics.join(','));
        
        const types = this.getSelectedValues('type-filter');
        if (types.length) params.set('types', types.join(','));
        
        const quality = document.getElementById('quality-filter').value;
        if (quality) params.set('quality', quality);
        
        const url = window.location.origin + window.location.pathname + '?' + params.toString();
        
        // Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            alert('Share link copied to clipboard!\\n\\n' + url);
        }).catch(() => {
            prompt('Copy this link to share:', url);
        });
    }

    // Load filters from URL on init
    loadFiltersFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        const search = params.get('search');
        if (search) document.getElementById('search').value = search;
        
        const products = params.get('products');
        if (products) {
            const select = document.getElementById('product-filter');
            products.split(',').forEach(product => {
                Array.from(select.options).forEach(opt => {
                    if (opt.value === product) opt.selected = true;
                });
            });
        }
        
        const sizes = params.get('sizes');
        if (sizes) {
            const select = document.getElementById('size-filter');
            sizes.split(',').forEach(size => {
                Array.from(select.options).forEach(opt => {
                    if (opt.value === size) opt.selected = true;
                });
            });
        }
        
        const topics = params.get('topics');
        if (topics) {
            const select = document.getElementById('topic-filter');
            topics.split(',').forEach(topic => {
                Array.from(select.options).forEach(opt => {
                    if (opt.value === topic) opt.selected = true;
                });
            });
        }
        
        const types = params.get('types');
        if (types) {
            const select = document.getElementById('type-filter');
            types.split(',').forEach(type => {
                Array.from(select.options).forEach(opt => {
                    if (opt.value === type) opt.selected = true;
                });
            });
        }
        
        const quality = params.get('quality');
        if (quality) document.getElementById('quality-filter').value = quality;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.adViewer = new AdViewer();
});
