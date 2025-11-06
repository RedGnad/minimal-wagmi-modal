import { type RouteConfig, index } from "@react-router/dev/routes";

export default [
  // Make login the home page
  index("routes/login.tsx"),
] satisfies RouteConfig;
