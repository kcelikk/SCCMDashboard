/**
 * SCCM Dashboard — Sidebar Navigation
 */
(function () {
  'use strict';

  // Mobile toggle
  document.addEventListener('click', function (e) {
    if (e.target.closest('.mobile-menu-toggle')) {
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    }
  });

  // Close sidebar on overlay click (mobile)
  document.addEventListener('click', function (e) {
    if (window.innerWidth <= 768 && e.target === document.querySelector('.main-wrapper')) {
      var sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }
  });
})();
