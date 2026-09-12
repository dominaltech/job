/**
 * Dominal Technology Jobs - Main Application Controller
 * Handles SPA navigation, data loading, rendering, filter states, drawer interactions, and toasts.
 */

const App = (() => {
  let allJobs = [];
  let currentView = 'home';
  let activeCategoryFilter = 'all';
  let searchQuery = '';

  /**
   * Initialize Application
   */
  async function init() {
    initNavigation();
    initDrawer();
    initSearchAndFilters();
    initSettingsForm();
    initActivityLog();
    initSecondaryActions();

    // Register PWA service worker and install triggers
    if (typeof PwaManager !== 'undefined') {
      PwaManager.registerServiceWorker();
      PwaManager.initInstallListeners();
    }

    // Load jobs data
    await loadJobsData();

    // Listen for shared jobs to re-render feed cards
    window.addEventListener('dominal:job-shared', () => {
      renderJobFeed();
      renderActivityLog();
      updateCategoryStats();
      showToast('Opening WhatsApp & logged to Activity');
    });

    window.addEventListener('dominal:job-shared-updated', () => {
      renderJobFeed();
      renderActivityLog();
    });

    // Handle initial hash route if any
    const initialHash = window.location.hash.replace('#', '');
    if (['home', 'categories', 'activity', 'settings'].includes(initialHash)) {
      switchView(initialHash);
    } else {
      switchView('home');
    }
  }

  /**
   * Load Jobs from local JSON or fallback
   */
  async function loadJobsData(isManualRefresh = false) {
    const feedContainer = document.getElementById('job-feed-list');
    if (feedContainer && !isManualRefresh) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
          </div>
          <h3>Loading Latest Jobs...</h3>
          <p>Fetching verified listings from Dominal Technology feed.</p>
        </div>
      `;
    }

    try {
      const response = await fetch('./data/jobs.json?ts=' + Date.now());
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      allJobs = await response.json();
    } catch (err) {
      console.warn('Network fetch failed or local file load issue:', err);
      // Fallback in-memory dataset if fetch fails
      if (allJobs.length === 0) {
        allJobs = getDefaultJobsFallback();
      }
    }

    // Enhance jobs with categorization
    allJobs = allJobs.map(job => {
      const cat = JobSorter.categorizeJob(job);
      return {
        ...job,
        primaryCategory: cat.primaryCategory,
        subCategory: cat.subCategory,
        subCategoryId: cat.subCategoryId,
        iconId: cat.iconId
      };
    });

    renderJobFeed();
    updateCategoryStats();

    if (isManualRefresh) {
      showToast('Jobs feed refreshed successfully');
    }
  }

  /**
   * SPA View Switching
   */
  function switchView(viewName) {
    if (!['home', 'categories', 'activity', 'settings'].includes(viewName)) {
      viewName = 'home';
    }
    currentView = viewName;
    window.location.hash = '#' + viewName;

    // Toggle active view section
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active-view');
    });
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active-view');
    }

    // Update bottom taskbar items
    document.querySelectorAll('.taskbar-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      }
    });

    // Update drawer links
    document.querySelectorAll('.drawer-link[data-view]').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });

    // Scroll to top of viewport
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh specific view contents
    if (viewName === 'categories') {
      updateCategoryStats();
    } else if (viewName === 'activity') {
      renderActivityLog();
    } else if (viewName === 'settings') {
      updateLivePreview();
      if (typeof PwaManager !== 'undefined') {
        PwaManager.updateInstallButtonUI(true);
      }
    }

    closeDrawer();
  }

  /**
   * Bottom Taskbar Navigation & Drawer Links
   */
  function initNavigation() {
    document.querySelectorAll('[data-view]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        const view = elem.dataset.view;
        switchView(view);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (['home', 'categories', 'activity', 'settings'].includes(hash) && hash !== currentView) {
        switchView(hash);
      }
    });
  }

  /**
   * Drawer Interactions (Hamburger Menu)
   */
  function initDrawer() {
    const btnOpenDrawer = document.getElementById('btn-open-drawer');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const drawerContent = document.getElementById('drawer-content');

    if (btnOpenDrawer) {
      btnOpenDrawer.addEventListener('click', openDrawer);
    }
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', closeDrawer);
    }
    if (drawerBackdrop) {
      drawerBackdrop.addEventListener('click', closeDrawer);
    }
  }

  function openDrawer() {
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const drawerContent = document.getElementById('drawer-content');
    if (drawerBackdrop && drawerContent) {
      drawerBackdrop.classList.add('is-open');
      drawerContent.classList.add('is-open');
    }
  }

  function closeDrawer() {
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const drawerContent = document.getElementById('drawer-content');
    if (drawerBackdrop && drawerContent) {
      drawerBackdrop.classList.remove('is-open');
      drawerContent.classList.remove('is-open');
    }
  }

  /**
   * Search & Filter Logic on Home Feed
   */
  function initSearchAndFilters() {
    const searchInput = document.getElementById('input-job-search');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const filterPills = document.querySelectorAll('.filter-pill');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (btnClearSearch) {
          btnClearSearch.classList.toggle('visible', searchQuery.length > 0);
        }
        renderJobFeed();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchQuery = '';
          btnClearSearch.classList.remove('visible');
          renderJobFeed();
          searchInput.focus();
        }
      });
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeCategoryFilter = pill.dataset.filter || 'all';
        renderJobFeed();
      });
    });
  }

  /**
   * Render Job Feed List (Home View)
   */
  function renderJobFeed() {
    const feedContainer = document.getElementById('job-feed-list');
    const countDisplay = document.getElementById('feed-count-display');
    if (!feedContainer) return;

    const filteredJobs = JobSorter.filterJobs(allJobs, {
      query: searchQuery,
      category: activeCategoryFilter
    });

    if (countDisplay) {
      countDisplay.textContent = `Showing ${filteredJobs.length} of ${allJobs.length} Jobs`;
    }

    if (filteredJobs.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-search"></use></svg>
          </div>
          <h3>No Matching Jobs Found</h3>
          <p>Try searching with different keywords or clear category filters.</p>
          <button class="btn-secondary" onclick="App.resetFilters()">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-refresh"></use></svg>
            <span>Reset Search & Filters</span>
          </button>
        </div>
      `;
      return;
    }

    feedContainer.innerHTML = filteredJobs.map(job => {
      const isShared = WhatsAppManager.isJobSent(job.id);
      const catBadgeClass = getBadgeClass(job.primaryCategory, job.subCategoryId);

      return `
        <article class="job-card ${isShared ? 'is-shared' : ''}" id="card-${escapeHtml(job.id)}">
          <div class="job-card-header">
            <span class="job-category-badge ${catBadgeClass}">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#${job.iconId || 'icon-briefcase'}"></use></svg>
              <span>${escapeHtml(job.subCategory || job.primaryCategory)}</span>
            </span>
            <span class="job-posted-time">${escapeHtml(job.posted_date || 'Recent')}</span>
          </div>

          ${isShared ? `
            <div class="job-shared-ribbon">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
              <span>Shared to WhatsApp</span>
            </div>
          ` : ''}

          <h3 class="job-card-title">${escapeHtml(job.title)}</h3>

          <div class="job-meta-list">
            <div class="job-meta-item">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-building"></use></svg>
              <span class="job-company-name">${escapeHtml(job.company)}</span>
            </div>
            <div class="job-meta-item">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-map-pin"></use></svg>
              <span>${escapeHtml(job.location || 'Location upon request')}</span>
            </div>
          </div>

          ${job.description ? `
            <p class="job-card-description">${escapeHtml(job.description)}</p>
          ` : ''}

          <div class="job-tags-row">
            ${job.experience ? `
              <span class="job-tag">Exp: ${escapeHtml(job.experience)}</span>
            ` : ''}
            ${job.salary ? `
              <span class="job-tag">Salary: ${escapeHtml(job.salary)}</span>
            ` : ''}
            ${job.job_type ? `
              <span class="job-tag">${escapeHtml(job.job_type)}</span>
            ` : ''}
          </div>

          <div class="job-actions-row">
            <button class="btn-share-whatsapp" onclick="App.handleShareJob('${escapeHtml(job.id)}')">
              <svg class="svg-icon" viewBox="0 0 24 24"><use href="${isShared ? '#icon-check' : '#icon-share'}"></use></svg>
              <span>${isShared ? 'Share Again (WhatsApp)' : 'Share to WhatsApp'}</span>
            </button>
            ${job.job_link ? `
              <a href="${escapeHtml(job.job_link)}" target="_blank" rel="noopener noreferrer" class="btn-view-link" title="Open Job Source">
                <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-external-link"></use></svg>
              </a>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  function getBadgeClass(primary, subCategoryId) {
    if (subCategoryId === 'electrical') return 'badge-electrical';
    if (subCategoryId === 'sales') return 'badge-sales';
    if (primary === 'IT') return 'badge-it';
    if (primary === 'Non-IT') return 'badge-non-it';
    return 'badge-other';
  }

  /**
   * Handle Share action on job
   */
  function handleShareJob(jobId) {
    const job = allJobs.find(j => j.id === jobId);
    if (!job) return;
    WhatsAppManager.shareJob(job);
  }

  /**
   * Update Categories View Statistics & Cards
   */
  function updateCategoryStats() {
    const stats = JobSorter.getCategoryStats(allJobs);

    const elTotal = document.getElementById('stat-total-count');
    const elIt = document.getElementById('stat-it-count');
    const elNonIt = document.getElementById('stat-non-it-count');
    const elOther = document.getElementById('stat-other-count');

    if (elTotal) elTotal.textContent = stats.total;
    if (elIt) elIt.textContent = stats.it;
    if (elNonIt) elNonIt.textContent = stats.nonIt;
    if (elOther) elOther.textContent = stats.other;

    // Subcategory counts breakdown
    const subcatList = document.getElementById('subcategory-breakdown-list');
    if (subcatList) {
      subcatList.innerHTML = JobSorter.SUBCATEGORY_RULES.map(rule => {
        const count = allJobs.filter(j => j.subCategoryId === rule.id).length;
        return `
          <div class="subcategory-item" onclick="App.filterByCategoryRule('${rule.id}')">
            <div class="subcat-info">
              <svg class="svg-icon" viewBox="0 0 24 24"><use href="#${rule.icon}"></use></svg>
              <span class="subcat-name">${escapeHtml(rule.name)}</span>
            </div>
            <span class="subcat-badge">${count} Jobs</span>
          </div>
        `;
      }).join('');
    }
  }

  function filterByCategoryRule(ruleId) {
    activeCategoryFilter = ruleId;
    switchView('home');

    // Update filter pills on home
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.filter === ruleId);
    });
    renderJobFeed();
  }

  function filterByPrimaryCategory(catName) {
    activeCategoryFilter = catName.toLowerCase();
    switchView('home');

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.filter === activeCategoryFilter);
    });
    renderJobFeed();
  }

  /**
   * Reset Filters
   */
  function resetFilters() {
    searchQuery = '';
    activeCategoryFilter = 'all';

    const searchInput = document.getElementById('input-job-search');
    if (searchInput) searchInput.value = '';

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(p => {
      p.classList.toggle('active', p.dataset.filter === 'all');
    });

    renderJobFeed();
  }

  /**
   * Render Activity / Sent Log View
   */
  function renderActivityLog() {
    const listContainer = document.getElementById('activity-log-list');
    const badgeTaskbar = document.getElementById('taskbar-activity-badge');
    if (!listContainer) return;

    const log = WhatsAppManager.getSentLog();

    if (badgeTaskbar) {
      badgeTaskbar.textContent = log.length;
      badgeTaskbar.style.display = log.length > 0 ? 'inline-block' : 'none';
    }

    if (log.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg class="svg-icon svg-icon-lg" viewBox="0 0 24 24"><use href="#icon-clock"></use></svg>
          </div>
          <h3>No Sent Activity Yet</h3>
          <p>When you click "Share to WhatsApp" on any job card, it will be logged here with its timestamp.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = log.map(entry => {
      return `
        <div class="activity-item">
          <div class="activity-top">
            <h4 class="activity-title">${escapeHtml(entry.title)}</h4>
            <span class="activity-timestamp">${escapeHtml(entry.formattedDate)}</span>
          </div>
          <div class="activity-meta">
            <span><strong>Company:</strong> ${escapeHtml(entry.company)}</span>
            <span><strong>Target:</strong> +${escapeHtml(entry.phoneNumber || '918766882442')}</span>
          </div>
          <div class="activity-snippet">${escapeHtml(entry.messageSnippet)}</div>
          <div class="activity-actions">
            <button class="btn-sm-action" onclick="App.handleShareJob('${escapeHtml(entry.jobId)}')">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-share"></use></svg>
              <span>Resend</span>
            </button>
            <button class="btn-sm-action" onclick="WhatsAppManager.removeSentLogEntry('${escapeHtml(entry.jobId)}')">
              <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-trash"></use></svg>
              <span>Remove</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Settings Form & Live Preview
   */
  function initSettingsForm() {
    const inputPhone = document.getElementById('setting-wa-phone');
    const inputTemplate = document.getElementById('setting-wa-template');
    const inputSignature = document.getElementById('setting-wa-signature');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnResetSettings = document.getElementById('btn-reset-settings');
    const btnPwaInstall = document.getElementById('btn-pwa-install');

    // Populate saved values
    if (inputPhone) inputPhone.value = WhatsAppManager.getPhoneNumber();
    if (inputTemplate) inputTemplate.value = WhatsAppManager.getTemplate();
    if (inputSignature) inputSignature.value = WhatsAppManager.getSignature();

    // Live update preview on inputs
    [inputPhone, inputTemplate, inputSignature].forEach(el => {
      if (el) {
        el.addEventListener('input', updateLivePreview);
      }
    });

    // Token insertion buttons
    document.querySelectorAll('.token-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        const token = badge.dataset.token;
        if (inputTemplate && token) {
          const start = inputTemplate.selectionStart;
          const end = inputTemplate.selectionEnd;
          const val = inputTemplate.value;
          inputTemplate.value = val.substring(0, start) + token + val.substring(end);
          inputTemplate.focus();
          inputTemplate.selectionStart = inputTemplate.selectionEnd = start + token.length;
          updateLivePreview();
        }
      });
    });

    // Save Settings
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        if (inputPhone) WhatsAppManager.setPhoneNumber(inputPhone.value);
        if (inputTemplate) WhatsAppManager.setTemplate(inputTemplate.value);
        if (inputSignature) WhatsAppManager.setSignature(inputSignature.value);
        showToast('WhatsApp settings saved successfully');
      });
    }

    // Reset Defaults
    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        if (confirm('Reset WhatsApp template and phone number to default settings?')) {
          WhatsAppManager.resetDefaults();
          if (inputPhone) inputPhone.value = WhatsAppManager.getPhoneNumber();
          if (inputTemplate) inputTemplate.value = WhatsAppManager.getTemplate();
          if (inputSignature) inputSignature.value = WhatsAppManager.getSignature();
          updateLivePreview();
          showToast('Settings restored to defaults');
        }
      });
    }

    // PWA Install Trigger
    if (btnPwaInstall) {
      btnPwaInstall.addEventListener('click', () => {
        if (typeof PwaManager !== 'undefined') {
          PwaManager.promptInstall();
        }
      });
    }

    updateLivePreview();
  }

  function updateLivePreview() {
    const previewContainer = document.getElementById('settings-live-preview');
    const inputTemplate = document.getElementById('setting-wa-template');
    const inputSignature = document.getElementById('setting-wa-signature');
    if (!previewContainer) return;

    // Pick first job as sample, or mock object
    const sampleJob = (allJobs && allJobs.length > 0) ? allJobs[0] : {
      company: 'Cognizant Technology Solutions',
      title: 'Senior Full Stack Python Developer',
      location: 'Pune, Maharashtra (Hybrid)',
      job_type: 'Full-time',
      experience: '4-7 years',
      salary: '14 - 18 LPA',
      job_link: 'https://careers.cognizant.com/job/python-101'
    };

    const customTemplate = inputTemplate ? inputTemplate.value : null;
    const customSignature = inputSignature ? inputSignature.value : null;

    const formatted = WhatsAppManager.formatMessage(sampleJob, customTemplate, customSignature);
    previewContainer.textContent = formatted;
  }

  /**
   * Secondary Actions (Refresh, Cache Clear, About Modal)
   */
  function initSecondaryActions() {
    // Quick refresh buttons (Header and Drawer)
    document.querySelectorAll('.btn-refresh-data').forEach(btn => {
      btn.addEventListener('click', () => {
        loadJobsData(true);
        closeDrawer();
      });
    });

    // Clear Cache buttons
    document.querySelectorAll('.btn-clear-cache').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Clear all offline cache and reload fresh application files?')) {
          if (typeof PwaManager !== 'undefined') {
            await PwaManager.clearOfflineCache();
          }
          showToast('Cache cleared. Reloading application...');
          setTimeout(() => {
            window.location.reload(true);
          }, 600);
        }
      });
    });

    // About Dominal Modal
    const btnAbout = document.getElementById('btn-open-about');
    const modalAbout = document.getElementById('modal-about');
    const btnCloseAbout = document.getElementById('btn-close-about');

    if (btnAbout && modalAbout) {
      btnAbout.addEventListener('click', () => {
        closeDrawer();
        modalAbout.classList.add('is-open');
      });
    }
    if (btnCloseAbout && modalAbout) {
      btnCloseAbout.addEventListener('click', () => {
        modalAbout.classList.remove('is-open');
      });
    }

    // iOS Install Modal Close
    const modalIos = document.getElementById('modal-ios-install');
    const btnCloseIos = document.getElementById('btn-close-ios');
    if (btnCloseIos && modalIos) {
      btnCloseIos.addEventListener('click', () => {
        modalIos.classList.remove('is-open');
      });
    }
  }

  /**
   * Toast notification display
   */
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24"><use href="#icon-check-circle"></use></svg>
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Fallback mock dataset
   */
  function getDefaultJobsFallback() {
    return [
      {
        id: "dom-job-101",
        title: "Senior Full Stack Python Developer",
        company: "Cognizant Technology Solutions",
        location: "Pune, Maharashtra (Hybrid)",
        job_type: "Full-time",
        experience: "4-7 years",
        salary: "14 - 18 LPA",
        posted_date: "Today",
        description: "Seeking an experienced Full Stack Python Developer with expertise in Django, FastAPI, React, and cloud deployments on AWS.",
        job_link: "https://careers.cognizant.com/global/en/job/python-fullstack-101"
      },
      {
        id: "dom-job-102",
        title: "AI / ML Engineer (Generative AI)",
        company: "Infosys Innovation Labs",
        location: "Bengaluru, Karnataka (Remote)",
        job_type: "Full-time",
        experience: "2-5 years",
        salary: "16 - 22 LPA",
        posted_date: "Today",
        description: "Looking for an AI Engineer proficient in LLM fine-tuning, RAG pipelines, PyTorch, LangChain, and production inference deployment.",
        job_link: "https://careers.infosys.com/job/ai-engineer-genai-102"
      },
      {
        id: "dom-job-103",
        title: "Electrical Power Systems Engineer",
        company: "Schneider Electric India",
        location: "Mumbai, Maharashtra (On-site)",
        job_type: "Full-time",
        experience: "3-6 years",
        salary: "9 - 13 LPA",
        posted_date: "Yesterday",
        description: "Responsible for medium and high voltage substation designs, switchgear testing, single-line diagrams, and safety compliance audits.",
        job_link: "https://se.com/careers/job/electrical-power-engineer-103"
      }
    ];
  }

  return {
    init,
    switchView,
    openDrawer,
    closeDrawer,
    handleShareJob,
    filterByCategoryRule,
    filterByPrimaryCategory,
    resetFilters,
    showToast
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
