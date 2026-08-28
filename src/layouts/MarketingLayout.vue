<!--
  MarketingLayout — public SaaS landing shell (/marketing/*).
  Clean, modern layout with TSCL branding. Used for pricing, register,
  and marketing login. Completely separate look from the MRK staff panel.
-->
<template>
  <div class="marketing-layout">
    <header class="mkt-header">
      <div class="mkt-header-inner">
        <router-link to="/portal/pricing" class="mkt-logo">
          <span class="mkt-logo-icon"><i class="fas fa-cloud"></i></span>
          <span class="mkt-logo-text">TSCL</span>
        </router-link>
        <nav class="mkt-nav">
          <router-link to="/portal/pricing" class="mkt-nav-link">Pricing</router-link>
          <router-link to="/portal/login" class="mkt-nav-link">Sign In</router-link>
          <router-link to="/portal/register" class="btn btn-sm btn-primary">Get Started</router-link>
        </nav>
        <button class="mkt-hamburger" @click="mobileNavOpen = !mobileNavOpen" aria-label="Menu">
          <i :class="mobileNavOpen ? 'fas fa-times' : 'fas fa-bars'"></i>
        </button>
      </div>
      <!-- Mobile nav dropdown -->
      <div v-if="mobileNavOpen" class="mkt-mobile-nav">
        <router-link to="/portal/pricing" class="mkt-mobile-link" @click="mobileNavOpen = false">Pricing</router-link>
        <router-link to="/portal/login" class="mkt-mobile-link" @click="mobileNavOpen = false">Sign In</router-link>
        <router-link to="/portal/register" class="mkt-mobile-link mkt-mobile-cta" @click="mobileNavOpen = false">Get
          Started</router-link>
      </div>
    </header>

    <main class="mkt-main">
      <router-view />
    </main>

    <footer class="mkt-footer">
      <div class="mkt-footer-inner">
        <div class="mkt-footer-brand">
          <span class="mkt-logo-icon"><i class="fas fa-cloud"></i></span>
          <span class="mkt-logo-text">TSCL</span>
          <p>Hotel management platform for the modern hospitality industry.</p>
        </div>
        <div class="mkt-footer-links">
          <div>
            <h4>Product</h4>
            <router-link to="/portal/pricing">Pricing</router-link>
            <a href="#">Features</a>
            <a href="#">Integrations</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Contact</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
      </div>
      <div class="mkt-footer-bottom">
        <p>&copy; {{ new Date().getFullYear() }} TSCL. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const mobileNavOpen = ref(false)
</script>

<style scoped>
.marketing-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Header */
.mkt-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e2e8f0;
}

.mkt-header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mkt-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #1e293b;
}

.mkt-logo-icon {
  font-size: 22px;
  color: #3b82f6;
}

.mkt-logo-text {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.mkt-nav {
  display: flex;
  align-items: center;
  gap: 24px;
}

.mkt-nav-link {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  text-decoration: none;
  transition: color 0.15s;
}

.mkt-nav-link:hover {
  color: #1e293b;
}

.mkt-hamburger {
  display: none;
  background: none;
  border: none;
  font-size: 20px;
  color: #334155;
  cursor: pointer;
}

.mkt-mobile-nav {
  display: none;
  flex-direction: column;
  padding: 8px 24px 16px;
  border-top: 1px solid #f1f5f9;
}

.mkt-mobile-link {
  padding: 10px 0;
  font-size: 14px;
  color: #334155;
  text-decoration: none;
  border-bottom: 1px solid #f1f5f9;
}

.mkt-mobile-cta {
  color: #3b82f6;
  font-weight: 600;
  border-bottom: none;
}

/* Main */
.mkt-main {
  flex: 1;
}

/* Footer */
.mkt-footer {
  background: #1e293b;
  color: #94a3b8;
  padding: 48px 24px 0;
}

.mkt-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.5fr 2fr;
  gap: 48px;
  padding-bottom: 40px;
}

.mkt-footer-brand p {
  font-size: 13px;
  line-height: 1.6;
  margin-top: 12px;
  max-width: 280px;
}

.mkt-footer-brand .mkt-logo-icon {
  color: #3b82f6;
}

.mkt-footer-brand .mkt-logo-text {
  color: #fff;
  font-size: 18px;
  font-weight: 800;
}

.mkt-footer-links {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.mkt-footer-links h4 {
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 12px;
}

.mkt-footer-links a {
  display: block;
  font-size: 13px;
  color: #94a3b8;
  text-decoration: none;
  padding: 4px 0;
  transition: color 0.15s;
}

.mkt-footer-links a:hover {
  color: #e2e8f0;
}

.mkt-footer-bottom {
  border-top: 1px solid #334155;
  padding: 20px 0;
  text-align: center;
  font-size: 12px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .mkt-nav {
    display: none;
  }

  .mkt-hamburger {
    display: block;
  }

  .mkt-mobile-nav {
    display: flex;
  }

  .mkt-footer-inner {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .mkt-footer-links {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
