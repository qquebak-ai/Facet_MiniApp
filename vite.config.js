import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Приложение открывают в Telegram, часто на слабой сети: пока
        // один общий файл не доехал, на экране пусто. Разносим по частям,
        // чтобы браузер тянул их разом и кешировал по отдельности —
        // правки интерфейса больше не отправляют человека заново
        // скачивать библиотеки, которые не менялись.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // TON-библиотеки и их криптография остаются одним куском.
          // Порознь они ломаются: части ссылаются друг на друга, и при
          // раздельной загрузке одна успевает обратиться к другой раньше,
          // чем та готова — приложение падает на пустом месте.
          // Работа с базой и входом.
          if (id.includes("@supabase")) return "supabase";
          // Иконки — большой набор, меняется редко.
          if (id.includes("lucide-react")) return "icons";
          // Заплатки для узловых модулей (buffer, process) отдельным
          // куском не выносим: они инициализируются раньше всех, кто их
          // использует, и в своей части оказывались загружены позже —
          // приложение падало на «process не определён».
          // Пути с косыми чертами по краям — чтобы сюда не попали
          // соседи вроде lucide-react и react-is: разъехавшись по разным
          // частям, они грузятся раньше самого React, и приложение
          // падает на первом же обращении к нему.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
});
