import { defineConfig } from "@neon/config/v1";

// Neon Auth signs in staff (admin, lead elf, elf, Santa). Families never sign in.
export default defineConfig({
  auth: true,
});
