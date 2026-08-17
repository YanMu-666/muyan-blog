/* =============================================================
   coderliang 风主题 — 交互脚本
   ============================================================= */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- 主题切换（深色/浅色） ---------- */
  var themeToggle = document.getElementById('theme-toggle');
  function applyTheme(theme, save) {
    root.setAttribute('data-theme', theme);
    if (save) {
      try { localStorage.setItem('fmy-theme', theme); } catch (e) { /* ignore */ }
    }
    // 同步 Giscus 主题
    var frame = document.querySelector('iframe.giscus-frame');
    if (frame) {
      frame.contentWindow.postMessage(
        { giscus: { setConfig: { theme: theme === 'light' ? 'light' : 'dark_dimmed' } } },
        'https://giscus.app'
      );
    }
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('fmy-theme'); } catch (e) { /* ignore */ }
    var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(theme, false);
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  /* ---------- Hero 终端打字动画 ---------- */
  var heroCmd = document.getElementById('hero-cmd');
  var heroOut = document.getElementById('hero-out');
  if (heroCmd && heroOut) {
    var text = 'whoami';
    var i = 0;
    heroOut.style.visibility = 'hidden';
    (function type() {
      if (i <= text.length) {
        heroCmd.textContent = text.slice(0, i);
        i++;
        setTimeout(type, 90);
      } else {
        setTimeout(function () { heroOut.style.visibility = 'visible'; }, 300);
      }
    })();
  }

  /* ---------- 首页标签页过滤 ---------- */
  var tabs = document.querySelectorAll('.tabs .tab');
  var cards = document.querySelectorAll('.post-card');
  if (tabs.length && cards.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var cat = tab.getAttribute('data-category');
        cards.forEach(function (card) {
          var cats = (card.getAttribute('data-cats') || '').split(',');
          var show = !cat || cats.indexOf(cat) !== -1;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }

  /* ---------- 站内搜索 ---------- */
  var searchToggle = document.getElementById('search-toggle');
  var searchModal = document.getElementById('search-modal');
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchStatus = document.getElementById('search-status');
  var searchIndex = null;
  var searchActive = 0;

  function openSearch() {
    if (!searchModal) return;
    searchModal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { if (searchInput) searchInput.focus(); }, 30);
  }
  function closeSearch() {
    if (!searchModal) return;
    searchModal.hidden = true;
    document.body.style.overflow = '';
  }
  function loadIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    return fetch('/search.json').then(function (r) { return r.json(); }).then(function (data) {
      searchIndex = data;
      return searchIndex;
    }).catch(function () { return []; });
  }
  function renderResults(results, query) {
    searchResults.innerHTML = '';
    if (!results.length) {
      var empty = document.createElement('li');
      empty.className = 'search-empty';
      empty.textContent = query ? '未找到匹配「' + query + '」的文章' : '输入关键词开始搜索';
      searchResults.appendChild(empty);
      return;
    }
    results.forEach(function (item, idx) {
      var li = document.createElement('li');
      li.className = 'search-result' + (idx === 0 ? ' active' : '');
      var a = document.createElement('a');
      a.href = item.path;
      var title = document.createElement('div');
      title.className = 'search-result-title';
      title.textContent = item.title;
      var meta = document.createElement('div');
      meta.className = 'search-result-meta';
      meta.textContent = item.date ? item.date : '';
      var snip = document.createElement('div');
      snip.className = 'search-result-meta';
      snip.style.marginTop = '2px';
      var content = item.content || '';
      var idx2 = query ? content.toLowerCase().indexOf(query.toLowerCase()) : -1;
      snip.textContent = idx2 >= 0
        ? '…' + content.slice(Math.max(0, idx2 - 40), idx2 + 90).replace(/\s+/g, ' ') + '…'
        : content.slice(0, 90).replace(/\s+/g, ' ');
      a.appendChild(title);
      a.appendChild(meta);
      if (query) a.appendChild(snip);
      li.appendChild(a);
      searchResults.appendChild(li);
    });
    var items = searchResults.querySelectorAll('.search-result');
    searchActive = 0;
    if (items.length) {
      items[0].querySelector('a').focus();
      items[0].scrollIntoView({ block: 'nearest' });
    }
  }
  function runSearch(query) {
    if (!query) {
      renderResults([], '');
      searchStatus.textContent = '输入关键词开始搜索';
      return;
    }
    searchStatus.textContent = '正在 grep...';
    loadIndex().then(function (index) {
      var q = query.toLowerCase();
      var results = index.filter(function (item) {
        var title = (item.title || '').toLowerCase();
        var content = (item.content || '').toLowerCase();
        return title.indexOf(q) !== -1 || content.indexOf(q) !== -1;
      });
      searchStatus.textContent = '匹配到 ' + results.length + ' 篇';
      renderResults(results, query);
    });
  }
  function moveSelection(dir) {
    var items = searchResults.querySelectorAll('.search-result');
    if (!items.length) return;
    items[searchActive].classList.remove('active');
    searchActive = (searchActive + dir + items.length) % items.length;
    items[searchActive].classList.add('active');
    items[searchActive].scrollIntoView({ block: 'nearest' });
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', openSearch);
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && searchModal && searchModal.hidden && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'Escape' && !searchModal.hidden) {
        closeSearch();
      } else if (!searchModal.hidden && e.key === 'Enter') {
        var active = searchResults.querySelector('.search-result.active a');
        if (active) { window.location.href = active.href; }
      } else if (!searchModal.hidden && e.key === 'ArrowDown') {
        e.preventDefault(); moveSelection(1);
      } else if (!searchModal.hidden && e.key === 'ArrowUp') {
        e.preventDefault(); moveSelection(-1);
      }
    });
    if (searchModal) {
      searchModal.addEventListener('click', function (e) {
        if (e.target.closest('[data-search-close]')) closeSearch();
      });
      searchInput.addEventListener('input', function () { runSearch(searchInput.value.trim()); });
    }
  }

  /* ---------- 目录滚动高亮 ---------- */
  var tocLinks = document.querySelectorAll('.toc-wrap .toc a');
  if (tocLinks.length) {
    var headings = [];
    tocLinks.forEach(function (link) {
      var id = link.getAttribute('href');
      if (id && id.charAt(0) === '#') {
        var el = document.getElementById(id.slice(1));
        if (el) headings.push({ el: el, link: link });
      }
    });
    var tocMarker = null;
    function updateToc() {
      var current = null;
      headings.forEach(function (h) {
        if (h.el.getBoundingClientRect().top <= 90) current = h;
      });
      if (current && current.link !== tocMarker) {
        if (tocMarker) tocMarker.classList.remove('active');
        current.link.classList.add('active');
        tocMarker = current.link;
      }
    }
    window.addEventListener('scroll', updateToc, { passive: true });
    updateToc();
  }
})();
