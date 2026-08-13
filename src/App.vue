<!--
  App — root component of the MRK Hotels frontend.
  Only hosts the <router-view>; every page renders through the router and its
  layout (StoreLayout, SuperadminLayout or OwnerLayout).
  On boot it re-arms the idle-session watchdog when a stored token says the
  user was signed in (e.g. after a refresh) — a fresh login arms it itself.
-->

<script setup>
import { onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useSessionStore } from "@/stores/session";

const authStore = useAuthStore();
const sessionStore = useSessionStore();

onMounted(() => {
  if (authStore.isAuthenticated) {
    sessionStore.start();
  }
});
</script>

<template>
  <router-view />
</template>

<style scoped></style>
