/**
 * Dominal Technology Jobs - Rule-Based Sorter & Categorization Engine
 * No AI dependencies; deterministic keyword matching with fallback to 'Other'.
 */

const JobSorter = (() => {
  // Keyword definitions
  const IT_KEYWORDS = [
    'software', 'developer', 'full stack', 'fullstack', 'backend', 'back-end',
    'frontend', 'front-end', 'python', 'ai engineer', 'ai developer', 'machine learning',
    'deep learning', 'nlp', 'llm', 'data scientist', 'data engineer', 'qa', 'quality assurance',
    'tester', 'testing', 'automation tester', 'devops', 'cloud', 'aws', 'azure', 'gcp',
    'react', 'angular', 'vue', 'node', 'java', 'spring', 'cybersecurity', 'security engineer',
    'database', 'sql', 'nosql', 'web', 'flutter', 'android', 'ios', 'mobile app', 'ui/ux',
    'system architect', 'golang', 'c++', 'c#', '.net', 'scrum master', 'kubernetes', 'docker'
  ];

  const NON_IT_KEYWORDS = [
    'electrical', 'electrician', 'power systems', 'substation', 'switchgear', 'embedded',
    'hardware', 'vlsi', 'pcb', 'electronics', 'mechanical', 'cad', 'solidworks', 'catia',
    'automotive', 'manufacturing', 'plant engineer', 'sales', 'business development', 'b2b',
    'inside sales', 'account manager', 'marketing', 'digital marketing', 'seo', 'ppc',
    'content strategist', 'hr', 'human resources', 'talent acquisition', 'recruiter',
    'recruitment', 'payroll', 'finance', 'financial', 'accountant', 'accounts', 'fp&a',
    'audit', 'taxation', 'operations', 'supply chain', 'logistics', 'warehouse', 'civil',
    'site engineer', 'procurement', 'admin', 'executive assistant', 'customer support', 'bpo'
  ];

  const SUBCATEGORY_RULES = [
    {
      id: 'electrical',
      name: 'Electrical & Hardware',
      icon: 'icon-lightning',
      keywords: ['electrical', 'electrician', 'power systems', 'substation', 'switchgear', 'embedded', 'hardware', 'vlsi', 'pcb', 'circuit', 'electronics']
    },
    {
      id: 'sales',
      name: 'Sales & Business Dev',
      icon: 'icon-chart',
      keywords: ['sales', 'business development', 'b2b', 'account executive', 'inside sales', 'bdr', 'sdr', 'tele-sales', 'quota', 'pipeline']
    },
    {
      id: 'software',
      name: 'Software Engineering',
      icon: 'icon-code',
      keywords: ['software', 'developer', 'full stack', 'backend', 'frontend', 'python', 'react', 'java', 'web', 'node', 'mobile app', 'c++', '.net']
    },
    {
      id: 'ai_data',
      name: 'AI & Data Science',
      icon: 'icon-cpu',
      keywords: ['ai engineer', 'ai developer', 'machine learning', 'data scientist', 'data engineer', 'llm', 'nlp', 'generative ai', 'pytorch']
    },
    {
      id: 'devops_qa',
      name: 'DevOps & QA',
      icon: 'icon-server',
      keywords: ['devops', 'cloud', 'qa', 'tester', 'testing', 'kubernetes', 'docker', 'terraform', 'automation tester', 'ci/cd']
    },
    {
      id: 'mechanical',
      name: 'Mechanical & CAD',
      icon: 'icon-wrench',
      keywords: ['mechanical', 'cad', 'solidworks', 'catia', 'automotive', 'manufacturing', 'tooling', 'transmission']
    },
    {
      id: 'hr_finance',
      name: 'HR, Finance & Operations',
      icon: 'icon-briefcase',
      keywords: ['hr', 'human resources', 'talent acquisition', 'recruiter', 'finance', 'accountant', 'fp&a', 'operations', 'supply chain', 'logistics']
    }
  ];

  /**
   * Helper to test whether any keyword in list exists in text.
   */
  function containsKeyword(text, keywords) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return keywords.some(kw => {
      // Regex word boundary matching when possible, or includes
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      return regex.test(lower);
    });
  }

  /**
   * Categorize a single job into primary category (IT, Non-IT, Other) and subcategory.
   */
  function categorizeJob(job) {
    const combinedText = `${job.title || ''} ${job.description || ''} ${job.company || ''}`;
    
    // Check specific subcategory first
    let subCategoryMatch = null;
    for (const rule of SUBCATEGORY_RULES) {
      if (containsKeyword(job.title, rule.keywords) || containsKeyword(combinedText, rule.keywords)) {
        subCategoryMatch = rule;
        break;
      }
    }

    // Determine primary category
    let primaryCategory = 'Other';
    let icon = 'icon-briefcase';

    if (containsKeyword(job.title, IT_KEYWORDS) || containsKeyword(combinedText, IT_KEYWORDS)) {
      primaryCategory = 'IT';
      icon = 'icon-code';
    } else if (containsKeyword(job.title, NON_IT_KEYWORDS) || containsKeyword(combinedText, NON_IT_KEYWORDS)) {
      primaryCategory = 'Non-IT';
      icon = 'icon-briefcase';
    }

    // If subcategory has a specific icon (e.g. electrical lightning, sales chart)
    if (subCategoryMatch) {
      icon = subCategoryMatch.icon;
      // Refine primary if subcategory is known
      if (['electrical', 'sales', 'mechanical', 'hr_finance'].includes(subCategoryMatch.id)) {
        primaryCategory = 'Non-IT';
      } else if (['software', 'ai_data', 'devops_qa'].includes(subCategoryMatch.id)) {
        primaryCategory = 'IT';
      }
    }

    return {
      primaryCategory,
      subCategory: subCategoryMatch ? subCategoryMatch.name : (primaryCategory === 'Other' ? 'General' : primaryCategory),
      subCategoryId: subCategoryMatch ? subCategoryMatch.id : 'other',
      iconId: icon
    };
  }

  /**
   * Filter job list by search query and category.
   */
  function filterJobs(jobs, { query = '', category = 'all' } = {}) {
    if (!Array.isArray(jobs)) return [];
    
    const cleanQuery = query.trim().toLowerCase();

    return jobs.filter(job => {
      const catInfo = categorizeJob(job);

      // Category matching
      if (category && category !== 'all') {
        if (category === 'it' && catInfo.primaryCategory !== 'IT') return false;
        if (category === 'non-it' && catInfo.primaryCategory !== 'Non-IT') return false;
        if (category === 'electrical' && catInfo.subCategoryId !== 'electrical') return false;
        if (category === 'sales' && catInfo.subCategoryId !== 'sales') return false;
        if (category === 'other' && catInfo.primaryCategory !== 'Other') return false;
      }

      // Keyword query matching
      if (cleanQuery) {
        const searchableText = `${job.title || ''} ${job.company || ''} ${job.location || ''} ${job.description || ''} ${job.experience || ''} ${catInfo.subCategory}`.toLowerCase();
        if (!searchableText.includes(cleanQuery)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate aggregated category statistics.
   */
  function getCategoryStats(jobs) {
    const stats = {
      total: jobs.length,
      it: 0,
      nonIt: 0,
      electrical: 0,
      sales: 0,
      other: 0
    };

    jobs.forEach(job => {
      const cat = categorizeJob(job);
      if (cat.primaryCategory === 'IT') stats.it++;
      else if (cat.primaryCategory === 'Non-IT') stats.nonIt++;
      else stats.other++;

      if (cat.subCategoryId === 'electrical') stats.electrical++;
      if (cat.subCategoryId === 'sales') stats.sales++;
    });

    return stats;
  }

  return {
    categorizeJob,
    filterJobs,
    getCategoryStats,
    IT_KEYWORDS,
    NON_IT_KEYWORDS,
    SUBCATEGORY_RULES
  };
})();
