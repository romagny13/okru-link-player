class OKRuLinkPlayer {
  constructor(options = {}) {
    this.version = "0.1.1";
    this._options = {
      rootContainer: null,
      showPreviewOnHover: false,
      tooltipDelay: 300,
      tooltipDefaultWidth: 480,
      tooltipDefaultHeight: 270,
      tooltipZoomEffect: true,
      tooltipMobileWidth: "90vw",
      tooltipMobileHeight: "auto",
      tooltipMobilePosition: "center",
      tooltipMobileTimeout: 3000,
      tooltipFallbackImage:
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgwIiBoZWlnaHQ9IjI3MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub24gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4=",
      showOnInit: false,
      showInPopup: false,
      popupWidth: "90vw", // Responsive
      popupHeight: "auto",
      popupMaxWidth: "1200px",
      embedBaseUrl: options.embedBaseUrl || "https://ok.ru/videoembed/",
      ...options,
    };

    this._activePlayers = new Map();
    this._tooltipCache = new Map();
    this._videoInfoCache = new Map();
    this._activePopup = null;
    this._isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    this._tooltipTimeout = null;
    this._tooltipDelayTimeout = null;
    this._rootElement =
      this._options.rootContainer instanceof HTMLElement
        ? this._options.rootContainer
        : document.querySelector(this._options.rootContainer) || document;

    this._init();
  }

  _init() {
    this._addGlobalStyles();
    this._bindEvents();

    if (this._options.showOnInit) {
      this._initializeDefaultPlayers();
    }
  }

  _addGlobalStyles() {
    if (!document.querySelector("#okru-preview-styles")) {
      const style = document.createElement("style");
      style.id = "okru-preview-styles";
      style.textContent = `
              .okru-player-wrapper {
                    position: relative;
                    width: 100%;
                    margin: 20px 0;
                    opacity: 0;
                    transform: translateY(20px);
                    transition: all 0.3s ease;
                    display: none;
                }
    
                .okru-player-wrapper.active {
                    opacity: 1;
                    transform: translateY(0);
                    display: block;
                }
    
                .okru-player-wrapper:before {
                    content: '';
                    display: block;
                    padding-top: 56.25%;
                }
    
                .okru-player-wrapper iframe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border: none;
                    border-radius: 8px;
                    overflow: hidden; /* Empêche le défilement interne */
                    scrollbar-width: none; /* Masque la scrollbar (Firefox) */
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
    
                .okru-tooltip {
                    position: fixed;
                    background: #fff;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    padding: 0;
                    z-index: 100;
                    opacity: 0;
                    transform: translateY(10px);
                    transition: all 0.3s ease;
                    overflow: hidden;
                    pointer-events: none;
                    width: ${
                      this._isTouchDevice
                        ? this._options.tooltipMobileWidth
                        : this._options.tooltipDefaultWidth + "px"
                    };
                    ${
                      this._isTouchDevice
                        ? `height: ${this._options.tooltipMobileHeight};`
                        : ""
                    }
                }
    
                .okru-tooltip.active {
                    opacity: 1;
                    transform: translateY(0);
                }
    
                .okru-tooltip-thumbnail {
                    position: relative;
                    width: 100%;
                    background: #000;
                }
    
                .okru-tooltip-thumbnail img {
                    width: 100%;
                    display: block;
                    transition: transform 0.3s ease;
                }
    
                ${
                  this._options.tooltipZoomEffect
                    ? `
                .okru-tooltip:hover .okru-tooltip-thumbnail img {
                    transform: scale(1.05);
                }
                `
                    : ""
                }
    
              .okru-tooltip-play {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 60px;
                  height: 60px;
                  background: rgba(0,0,0,0.7);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
    
              .okru-tooltip-play::after {
                  content: '';
                  width: 0;
                  height: 0;
                  border-style: solid;
                  border-width: 10px 0 10px 20px;
                  border-color: transparent transparent transparent #ffffff;
                  margin-left: 5px;
              }
    
              .okru-tooltip-info {
                  padding: 12px;
                  background: #fff;
              }
    
              .okru-tooltip-title {
                  font-family: Arial, sans-serif;
                  font-size: 14px;
                  color: #333;
                  margin: 0;
                  line-height: 1.4;
                  font-weight: 600;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
              }
    
              .okru-loader {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 40px;
                  height: 40px;
                  border: 3px solid rgba(255,255,255,0.3);
                  border-top: 3px solid #fff;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
              }
    
              @keyframes spin {
                  0% { transform: translate(-50%, -50%) rotate(0deg); }
                  100% { transform: translate(-50%, -50%) rotate(360deg); }
              }
  
              .okru-popup-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    padding: 20px;
                    box-sizing: border-box;
                }
                
                .okru-popup-overlay.active {
                    opacity: 1;
                }
                
                .okru-popup-container {
                    position: relative;
                    width: ${this._options.popupWidth};
                    max-width: ${this._options.popupMaxWidth};
                    background: #000;
                    border-radius: 8px;
                    overflow: hidden;
                    transform: scale(0.9);
                    transition: transform 0.3s ease;
                }
                
                .okru-popup-container:before {
                    content: '';
                    display: block;
                    padding-top: 56.25%;
                }
                
                .okru-popup-overlay.active .okru-popup-container {
                    transform: scale(1);
                }
                
                .okru-popup-close {
                    position: absolute;
                    top: -40px;
                    right: 0;
                    width: 40px;
                    height: 40px;
                    background: #fff;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    color: #000;
                    border: none;
                    padding: 0;
                    z-index: 2;
                }
                
                .okru-popup-close:hover {
                    background: #f0f0f0;
                }
                
                .okru-popup-iframe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border: none;
                }
  
                @media (max-width: 768px) {
                    .okru-popup-overlay {
                        padding: 0;
                    }
  
                    .okru-popup-container {
                        width: 100%;
                        height: auto;
                        border-radius: 0;
                    }
  
                    .okru-popup-close {
                        top: 10px;
                        right: 10px;
                        background: rgba(255, 255, 255, 0.9);
                    }
                }
            `;
      document.head.appendChild(style);
    }
  }

  _bindEvents() {
    if (this._isTouchDevice) {
      this._rootElement.addEventListener(
        "touchstart",
        this._handleTouch.bind(this),
        { passive: true }
      );
    } else if (this._options.showPreviewOnHover) {
      this._rootElement.addEventListener(
        "mouseover",
        this._handleHover.bind(this)
      );
      this._rootElement.addEventListener(
        "mouseout",
        this._handleMouseOut.bind(this)
      );
    }

    this._rootElement.addEventListener("click", this._handleClick.bind(this));
  }

  async _getVideoTitle(videoId, trigger) {
    return trigger ? trigger.textContent.trim() : "Vidéo OK.ru";
  }

  _initializeDefaultPlayers() {
    const triggers = this._rootElement.querySelectorAll(
      '[data-okru-link][data-show-on-init="true"]'
    );
    triggers.forEach((trigger) => {
      this._loadVideo(trigger);
    });
  }

  _handleTouch(event) {
    const trigger = event.target.closest("[data-okru-link]");
    if (!trigger || !this._options.showPreviewOnHover) return;

    if (this._tooltipTimeout) {
      clearTimeout(this._tooltipTimeout);
    }

    this._showTooltip(trigger);

    this._tooltipTimeout = setTimeout(() => {
      this.hideTooltip();
    }, this._options.tooltipMobileTimeout);
  }

  _handleHover(event) {
    const trigger = event.target.closest("[data-okru-link]");
    if (!trigger || !this._options.showPreviewOnHover) return;

    if (this._tooltipDelayTimeout) {
      clearTimeout(this._tooltipDelayTimeout);
    }

    this._tooltipDelayTimeout = setTimeout(() => {
      this._showTooltip(trigger);
    }, this._options.tooltipDelay);
  }

  async _loadTooltipContent(tooltip, videoId, trigger) {
    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.className = "okru-tooltip-thumbnail";

    const loader = document.createElement("div");
    loader.className = "okru-loader";
    thumbnailContainer.appendChild(loader);

    tooltip.appendChild(thumbnailContainer);

    let videoInfo = this._videoInfoCache.get(videoId);

    if (!videoInfo) {
      const thumbnail =
        trigger.getAttribute("data-thumbnail") ||
        this._options.tooltipFallbackImage;
      videoInfo = {
        thumbnail: thumbnail,
        title: await this._getVideoTitle(videoId, trigger),
      };
      this._videoInfoCache.set(videoId, videoInfo);
    }

    const img = new Image();
    img.onload = () => {
      this._completeTooltipLoad(
        tooltip,
        thumbnailContainer,
        loader,
        img,
        videoInfo
      );
    };
    img.onerror = () => {
      img.src = this._options.tooltipFallbackImage;
    };
    img.src = videoInfo.thumbnail;
  }

  async _showTooltip(trigger) {
    const videoId = this._getVideoId(trigger.href);
    if (!videoId) return;

    const target = this._getTargetId(trigger);
    if (
      this._activePlayers.has(target) &&
      this._activePlayers.get(target).wrapper.classList.contains("active")
    ) {
      return;
    }

    const tooltip = this._createTooltip();

    if (this._isTouchDevice) {
      this._positionMobileTooltip(tooltip, this._options.tooltipMobilePosition);
    } else {
      const rect = trigger.getBoundingClientRect();
      tooltip.style.left = `${rect.left}px`;
      tooltip.style.top = `${rect.bottom + 10}px`;
    }

    await this._loadTooltipContent(tooltip, videoId, trigger);
  }

  _completeTooltipLoad(tooltip, thumbnailContainer, loader, img, videoInfo) {
    loader.remove();

    thumbnailContainer.appendChild(img);

    const playButton = document.createElement("div");
    playButton.className = "okru-tooltip-play";
    thumbnailContainer.appendChild(playButton);

    const infoDiv = document.createElement("div");
    infoDiv.className = "okru-tooltip-info";

    const titleP = document.createElement("p");
    titleP.className = "okru-tooltip-title";
    titleP.textContent = videoInfo.title;

    infoDiv.appendChild(titleP);
    tooltip.appendChild(infoDiv);

    tooltip.classList.add("active");
  }

  _positionMobileTooltip(tooltip, position) {
    const viewportHeight = window.innerHeight;
    const tooltipHeight =
      this._options.tooltipMobileHeight === "auto"
        ? tooltip.offsetHeight
        : parseInt(this._options.tooltipMobileHeight);

    switch (position) {
      case "top":
        tooltip.style.top = "20px";
        break;
      case "bottom":
        tooltip.style.bottom = "20px";
        break;
      case "center":
      default:
        tooltip.style.top = `${(viewportHeight - tooltipHeight) / 2}px`;
        break;
    }

    tooltip.style.left = `${
      (window.innerWidth - parseInt(this._options.tooltipMobileWidth)) / 2
    }px`;
  }

  _handleMouseOut(event) {
    const tooltip = document.querySelector(".okru-tooltip");
    if (tooltip) {
      tooltip.remove();
    }
  }

  _createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.className = "okru-tooltip";
    document.body.appendChild(tooltip);
    return tooltip;
  }

  _getTargetId(trigger) {
    return trigger.getAttribute("data-okru-target") || "inline-" + trigger.href;
  }

  _handleClick(event) {
    const trigger = event.target.closest("[data-okru-link]");
    if (!trigger) return;

    event.preventDefault();

    const showInPopup =
      trigger.getAttribute("data-show-in-popup") === "true"
        ? true
        : trigger.getAttribute("data-show-in-popup") === "false"
        ? false
        : this._options.showInPopup;

    if (showInPopup) {
      this._loadVideoInPopup(trigger);
    } else {
      const target = this._getTargetId(trigger);
      const activePlayer = this._activePlayers.get(target);

      if (activePlayer && activePlayer.trigger === trigger) {
        this._hideVideo(activePlayer.wrapper, trigger);
        return;
      }

      if (activePlayer) {
        this._hideVideo(activePlayer.wrapper, activePlayer.trigger);
      }

      this._loadVideo(trigger);
    }
  }

  _loadVideoInPopup(trigger) {
    const videoId = this._getVideoId(trigger.href);
    if (!videoId) return;

    if (this._activePopup) {
      this._closePopup();
    }

    const overlay = document.createElement("div");
    overlay.className = "okru-popup-overlay";

    const container = document.createElement("div");
    container.className = "okru-popup-container";

    const closeButton = document.createElement("button");
    closeButton.className = "okru-popup-close";
    closeButton.innerHTML = "×";
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this._closePopup();
    });

    const embedUrl = `${this._options.embedBaseUrl}${videoId}`;

    const iframe = document.createElement("iframe");
    iframe.className = "okru-popup-iframe";
    iframe.src = `${embedUrl}?autoplay=1`;
    iframe.allow = "autoplay; fullscreen";
    iframe.allowFullscreen = true;

    container.appendChild(closeButton);
    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    document.body.style.overflow = "hidden";

    this._activePopup = overlay;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        this._closePopup();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this._closePopup();
      }
    });

    if (this._isTouchDevice) {
      let touchStartY = 0;
      let touchEndY = 0;

      overlay.addEventListener(
        "touchstart",
        (e) => {
          touchStartY = e.touches[0].clientY;
        },
        { passive: true }
      );

      overlay.addEventListener(
        "touchend",
        (e) => {
          touchEndY = e.changedTouches[0].clientY;
          if (Math.abs(touchEndY - touchStartY) > 50) {
            this._closePopup();
          }
        },
        { passive: true }
      );
    }

    requestAnimationFrame(() => {
      overlay.classList.add("active");
    });
  }

  _closePopup() {
    if (this._activePopup) {
      this._activePopup.classList.remove("active");
      document.body.style.overflow = "";

      setTimeout(() => {
        this._activePopup.remove();
        this._activePopup = null;
      }, 300);
    }
  }

  _hideVideo(wrapper, trigger) {
    const target = this._getTargetId(trigger);
    trigger.classList.remove("active");

    const iframe = wrapper.querySelector("iframe");
    if (iframe) {
      const currentSrc = new URL(iframe.src);
      currentSrc.searchParams.set("autoplay", "0");
      iframe.src = currentSrc.toString();
    }

    wrapper.classList.remove("active");

    this._activePlayers.delete(target);

    setTimeout(() => {
      wrapper.remove();
    }, 300);
  }

  _loadVideo(trigger) {
    const videoId = this._getVideoId(trigger.href);
    if (!videoId) return;

    const targetSelector = trigger.getAttribute("data-okru-target");
    const autoplay = trigger.getAttribute("data-autoplay") === "true";

    const wrapper = document.createElement("div");
    wrapper.className = "okru-player-wrapper";

    const embedUrl = `${this._options.embedBaseUrl}${videoId}`;

    const iframe = document.createElement("iframe");
    iframe.src = `${embedUrl}?autoplay=${autoplay ? 1 : 0}&nochat=1`;
    iframe.allow = "autoplay; fullscreen";
    iframe.allowFullscreen = true;
    
    wrapper.appendChild(iframe);

    if (targetSelector) {
      const targetElement = document.querySelector(targetSelector);
      if (!targetElement) return;
      targetElement.innerHTML = "";
      targetElement.appendChild(wrapper);
    } else {
      trigger.parentNode.insertBefore(wrapper, trigger.nextSibling);
    }

    this._activePlayers.set(this._getTargetId(trigger), { wrapper, trigger });

    trigger.classList.add("active");
    setTimeout(() => wrapper.classList.add("active"), 50);
  }

  _getVideoId(url) {
    // Extraction de l’ID depuis une URL OK.ru (ex : https://ok.ru/video/XXXXXXXX ou /videoembed/XXXXXXXX)
    const videoMatch = url.match(/ok\.ru\/video(?:embed)?\/([a-zA-Z0-9]+)/);
    return videoMatch ? videoMatch[1] : null;
  }
}
