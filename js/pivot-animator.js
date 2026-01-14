/**
 * Pivot Animation Engine
 * FLIP-based animation system for smooth layout transitions
 * Based on Paul Lewis's FLIP technique + Web Animations API
 */

class PivotAnimator {
    constructor(options = {}) {
        this.duration = options.duration || 800;
        this.easing = options.easing || 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'; // ease-out
        this.staggerDelay = options.staggerDelay || 0; // Optional stagger for cascading effect
        
        // Track running animations
        this.runningAnimations = new Map();
    }

    /**
     * FLIP Animation - The heart of smooth layout transitions
     * @param {HTMLElement[]} elements - Elements to animate
     * @param {Function} layoutChange - Function that changes the layout
     * @param {Object} options - Animation options
     */
    flip(elements, layoutChange, options = {}) {
        const duration = options.duration || this.duration;
        const easing = options.easing || this.easing;
        const onComplete = options.onComplete || (() => {});

        // FIRST: Record starting positions
        const firstPositions = new Map();
        elements.forEach(el => {
            if (el && el.getBoundingClientRect) {
                const rect = el.getBoundingClientRect();
                firstPositions.set(el, {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height,
                    opacity: parseFloat(getComputedStyle(el).opacity) || 1
                });
            }
        });

        // LAST: Apply the layout change
        layoutChange();

        // Force reflow to apply changes
        document.body.offsetHeight;

        // INVERT & PLAY: Calculate deltas and animate
        const animations = [];
        
        elements.forEach((el, index) => {
            if (!el || !firstPositions.has(el)) return;

            const first = firstPositions.get(el);
            const last = el.getBoundingClientRect();
            const lastOpacity = parseFloat(getComputedStyle(el).opacity) || 1;

            // Calculate deltas
            const deltaX = first.x - last.left;
            const deltaY = first.y - last.top;
            const deltaW = first.width / (last.width || 1);
            const deltaH = first.height / (last.height || 1);
            
            // Skip if no movement
            if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 && 
                Math.abs(deltaW - 1) < 0.01 && Math.abs(deltaH - 1) < 0.01 &&
                Math.abs(first.opacity - lastOpacity) < 0.01) {
                return;
            }

            // Cancel any running animation on this element
            if (this.runningAnimations.has(el)) {
                this.runningAnimations.get(el).cancel();
            }

            // Build keyframes
            const keyframes = [
                {
                    transform: `translate(${deltaX}px, ${deltaY}px) scale(${deltaW}, ${deltaH})`,
                    opacity: first.opacity
                },
                {
                    transform: 'translate(0, 0) scale(1, 1)',
                    opacity: lastOpacity
                }
            ];

            // Calculate delay for stagger effect
            const delay = this.staggerDelay * index;

            // Animate using Web Animations API
            const animation = el.animate(keyframes, {
                duration: duration,
                delay: delay,
                easing: easing,
                fill: 'forwards'
            });

            this.runningAnimations.set(el, animation);
            animations.push(animation);

            // Cleanup when done
            animation.onfinish = () => {
                this.runningAnimations.delete(el);
                // Clear the fill to allow CSS to take over
                el.style.transform = '';
            };
        });

        // Call onComplete when all animations finish
        Promise.all(animations.map(a => a.finished)).then(onComplete).catch(() => {});

        return animations;
    }

    /**
     * Animate elements fading out and optionally removing them
     * @param {HTMLElement[]} elements - Elements to fade out
     * @param {Object} options - Animation options
     */
    fadeOut(elements, options = {}) {
        const duration = options.duration || 300;
        const easing = options.easing || 'ease-out';
        const removeAfter = options.remove !== false;
        const onComplete = options.onComplete || (() => {});

        const animations = [];

        elements.forEach((el, index) => {
            if (!el) return;

            // Cancel any running animation
            if (this.runningAnimations.has(el)) {
                this.runningAnimations.get(el).cancel();
            }

            const keyframes = [
                { opacity: 1, transform: 'scale(1)' },
                { opacity: 0, transform: 'scale(0.8)' }
            ];

            const animation = el.animate(keyframes, {
                duration: duration,
                delay: this.staggerDelay * index,
                easing: easing,
                fill: 'forwards'
            });

            this.runningAnimations.set(el, animation);
            animations.push(animation);

            animation.onfinish = () => {
                this.runningAnimations.delete(el);
                if (removeAfter) {
                    el.style.display = 'none';
                    el.dataset.hidden = 'true';
                } else {
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0.8)';
                }
            };
        });

        Promise.all(animations.map(a => a.finished)).then(onComplete).catch(() => {});
        return animations;
    }

    /**
     * Animate elements fading in
     * @param {HTMLElement[]} elements - Elements to fade in
     * @param {Object} options - Animation options
     */
    fadeIn(elements, options = {}) {
        const duration = options.duration || 300;
        const easing = options.easing || 'ease-out';
        const onComplete = options.onComplete || (() => {});

        const animations = [];

        elements.forEach((el, index) => {
            if (!el) return;

            // Make visible first
            el.style.display = '';
            delete el.dataset.hidden;

            // Cancel any running animation
            if (this.runningAnimations.has(el)) {
                this.runningAnimations.get(el).cancel();
            }

            const keyframes = [
                { opacity: 0, transform: 'scale(0.8)' },
                { opacity: 1, transform: 'scale(1)' }
            ];

            const animation = el.animate(keyframes, {
                duration: duration,
                delay: this.staggerDelay * index,
                easing: easing,
                fill: 'forwards'
            });

            this.runningAnimations.set(el, animation);
            animations.push(animation);

            animation.onfinish = () => {
                this.runningAnimations.delete(el);
                el.style.opacity = '';
                el.style.transform = '';
            };
        });

        Promise.all(animations.map(a => a.finished)).then(onComplete).catch(() => {});
        return animations;
    }

    /**
     * Combined filter animation: fade out non-matches, FLIP remaining
     * @param {HTMLElement} container - Container element
     * @param {Function} filterFn - Returns true for elements that should remain visible
     * @param {Function} layoutFn - Function to recalculate layout positions
     */
    animateFilter(container, filterFn, layoutFn, options = {}) {
        const items = Array.from(container.children);
        const visible = [];
        const hidden = [];

        items.forEach(item => {
            if (filterFn(item)) {
                visible.push(item);
            } else {
                hidden.push(item);
            }
        });

        // Phase 1: Fade out hidden items
        if (hidden.length > 0) {
            this.fadeOut(hidden, {
                duration: 250,
                remove: true,
                onComplete: () => {
                    // Phase 2: FLIP remaining items to new positions
                    this.flip(visible, () => layoutFn(visible), {
                        duration: options.duration || 600,
                        onComplete: options.onComplete
                    });
                }
            });
        } else {
            // No items to hide, just FLIP
            this.flip(visible, () => layoutFn(visible), options);
        }
    }

    /**
     * Animate grouped layout change
     * @param {HTMLElement[]} items - All items to position
     * @param {Function} groupFn - Function that returns group key for each item
     * @param {Object} groupConfig - Configuration for group layout
     */
    animateGrouping(items, groupFn, groupConfig, options = {}) {
        const duration = options.duration || 1000;
        
        // Calculate new positions
        const groups = new Map();
        items.forEach(item => {
            const key = groupFn(item);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(item);
        });

        // FLIP animate to new positions
        this.flip(items, () => {
            // Apply new positions based on groups
            let blockX = 0;
            const itemSize = groupConfig.itemSize || 60;
            const itemGap = groupConfig.itemGap || 3;
            const blockGap = groupConfig.blockGap || 40;

            groups.forEach((groupItems, key) => {
                const count = groupItems.length;
                const cols = Math.ceil(Math.sqrt(count * 1.5));
                
                groupItems.forEach((item, i) => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const x = blockX + col * (itemSize + itemGap);
                    const y = row * (itemSize + itemGap);
                    
                    item.style.position = 'absolute';
                    item.style.left = x + 'px';
                    item.style.top = y + 'px';
                });

                // Move to next block
                const blockWidth = cols * (itemSize + itemGap);
                blockX += blockWidth + blockGap;
            });
        }, { duration: duration, onComplete: options.onComplete });

        return groups;
    }

    /**
     * Slide panel in from right
     * @param {HTMLElement} panel - Panel element to slide
     * @param {Object} options - Animation options
     */
    slideInRight(panel, options = {}) {
        const duration = options.duration || 400;
        
        panel.style.display = 'flex';
        
        const animation = panel.animate([
            { transform: 'translateX(100%)', opacity: 0.5 },
            { transform: 'translateX(0)', opacity: 1 }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
        });

        animation.onfinish = () => {
            panel.style.transform = '';
            panel.style.opacity = '';
            if (options.onComplete) options.onComplete();
        };

        return animation;
    }

    /**
     * Slide panel out to right
     * @param {HTMLElement} panel - Panel element to slide
     * @param {Object} options - Animation options
     */
    slideOutRight(panel, options = {}) {
        const duration = options.duration || 300;
        
        const animation = panel.animate([
            { transform: 'translateX(0)', opacity: 1 },
            { transform: 'translateX(100%)', opacity: 0.5 }
        ], {
            duration: duration,
            easing: 'ease-in',
            fill: 'forwards'
        });

        animation.onfinish = () => {
            panel.style.display = 'none';
            panel.style.transform = '';
            if (options.onComplete) options.onComplete();
        };

        return animation;
    }

    /**
     * Cancel all running animations
     */
    cancelAll() {
        this.runningAnimations.forEach(animation => animation.cancel());
        this.runningAnimations.clear();
    }
}

// Export for use
window.PivotAnimator = PivotAnimator;
