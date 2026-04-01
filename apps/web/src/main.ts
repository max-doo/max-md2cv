import { createApp } from "vue";
import { createPinia } from "pinia";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import App from "./App.vue";
import "./styles/app.css";

document.documentElement.classList.add("web-playground-root");
document.body.classList.add("web-playground-body");

const app = createApp(App);

app.use(createPinia());
app.mount("#app");
