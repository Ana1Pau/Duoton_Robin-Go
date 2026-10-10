import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kater: {
          50: "#effdf5",
          100: "#d9fbe7",
          500: "#16a34a",
          600: "#15803d",
          700: "#166534",
          900: "#0f2e1c",
        },
      },
    },
  },
  plugins: [],
};
export default config;
