import { createApp } from "vue";
import { createPinia } from "pinia";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import "./assets/tailwind.css";
import App from "./App.vue";
import { setupExternalLinkHandler } from "./utils/externalLink";

setupExternalLinkHandler();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount("#app");
