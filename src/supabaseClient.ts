import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Бросаем понятную ошибку вместо того, чтобы supabase-client молча
  // создавался с undefined-значениями (тогда все auth/db запросы
  // просто зависали бы или падали без внятной причины).
  throw new Error(
    "Supabase не настроен: отсутствуют VITE_SUPABASE_URL и/или VITE_SUPABASE_ANON_KEY. " +
    "Проверь файл .env локально и переменные окружения в настройках проекта на Vercel " +
    "(Project Settings → Environment Variables), затем сделай redeploy."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Разбор токенов из адресной строки выключен намеренно. Приложение
    // входит только по подписи Telegram и обменивает одноразовый токен
    // через verifyOtp, поэтому подхватывать сессию из ссылки не нужно —
    // а с включённым разбором чужая ссылка с параметрами могла бы
    // подсунуть открытому приложению постороннюю сессию.
    detectSessionInUrl: false,
    // Обмен кода на сессию с проверочным ключом: перехваченный код без
    // него бесполезен.
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
  },
});
