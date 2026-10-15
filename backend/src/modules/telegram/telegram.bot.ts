import { Bot, InlineKeyboard } from 'grammy';
import type { Env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import {
  getUserByChatId,
  linkTelegramAccount,
  setTelegramSender,
  setTelegramWebAppUrl,
  unlinkByChatId,
} from './telegram.service.js';

export function createTelegramBot(token: string, webAppUrl?: string): Bot {
  const bot = new Bot(token);

  // Xatoda bot yoki server ishdan chiqmasin
  bot.catch((err) => {
    logger.error('Grammy bot xatosi:', { err: err.error });
  });

  const getLang = (langCode?: string): 'uz' | 'ru' | 'en' => {
    if (langCode?.startsWith('ru')) return 'ru';
    if (langCode?.startsWith('en')) return 'en';
    return 'uz';
  };

  // /start buyrug'i: biriktirish oqimi (/start <token>) yoki xush kelibsiz
  bot.command('start', async (ctx) => {
    if (!ctx.from) return;
    const rawToken = ctx.match?.trim();
    const lang = getLang(ctx.from.language_code);

    if (rawToken) {
      const result = await linkTelegramAccount(rawToken, {
        id: ctx.from.id,
        username: ctx.from.username,
        language_code: ctx.from.language_code,
      });

      if (result.success) {
        const u = result.user;
        const messages = {
          uz: `✅ <b>Hisobingiz muvaffaqiyatli bog'landi!</b>\n\n👤 <b>Foydalanuvchi:</b> ${u.fullName}\n💼 <b>Rol:</b> ${u.role}${u.companyName ? `\n🏢 <b>Tashkilot:</b> ${u.companyName}` : ''}\n\nEndi tizim xabarnomalarini shu yerda qabul qilasiz.`,
          ru: `✅ <b>Ваш аккаунт успешно привязан!</b>\n\n👤 <b>Пользователь:</b> ${u.fullName}\n💼 <b>Роль:</b> ${u.role}${u.companyName ? `\n🏢 <b>Организация:</b> ${u.companyName}` : ''}\n\nТеперь вы будете получать уведомления системы здесь.`,
          en: `✅ <b>Your account has been linked successfully!</b>\n\n👤 <b>User:</b> ${u.fullName}\n💼 <b>Role:</b> ${u.role}${u.companyName ? `\n🏢 <b>Company:</b> ${u.companyName}` : ''}\n\nYou will now receive system notifications here.`,
        };

        const keyboard =
          webAppUrl && webAppUrl.startsWith('https://')
            ? new InlineKeyboard().webApp(
                lang === 'ru' ? 'Открыть LIMS' : lang === 'en' ? 'Open LIMS' : 'LIMS ni ochish',
                webAppUrl,
              )
            : undefined;

        await ctx.reply(messages[lang], { parse_mode: 'HTML', reply_markup: keyboard });
        return;
      }

      const errorMessages = {
        INVALID_TOKEN: {
          uz: "❌ Bog'lash kodi noto'g'ri yoki topilmadi. Profilingizdan yangi havola oling.",
          ru: '❌ Недействительный код привязки. Получите новую ссылку в профиле.',
          en: '❌ Invalid link token. Please generate a new link in your profile.',
        },
        ALREADY_USED: {
          uz: "⚠️ Ushbu bog'lash kodi allaqachon ishlatilgan. Profilingizdan yangi kod oling.",
          ru: '⚠️ Этот код привязки уже использован. Получите новый код в профиле.',
          en: '⚠️ This link token has already been used. Please generate a new one.',
        },
        EXPIRED: {
          uz: "⏰ Bog'lash kodining muddati o'tgan (15 daqiqa). Profilingizdan yangi kod oling.",
          ru: '⏰ Срок действия кода привязки истек (15 минут). Получите новый код в профиле.',
          en: '⏰ Link token has expired (15 minutes). Please generate a new one.',
        },
      };

      await ctx.reply(errorMessages[result.reason][lang]);
      return;
    }

    // Parametrsiz /start
    const existing = await getUserByChatId(ctx.from.id);
    if (existing) {
      const messages = {
        uz: `Xush kelibsiz, <b>${existing.fullName}</b>!\nSizning Telegram hisobingiz TizimLab tizimiga ulangan.\n\nBuyruqlar: /status, /unlink, /help`,
        ru: `С возвращением, <b>${existing.fullName}</b>!\nВаш Telegram привязан к системе TizimLab.\n\nКоманды: /status, /unlink, /help`,
        en: `Welcome, <b>${existing.fullName}</b>!\nYour Telegram is linked to TizimLab.\n\nCommands: /status, /unlink, /help`,
      };
      await ctx.reply(messages[lang], { parse_mode: 'HTML' });
    } else {
      const messages = {
        uz: `Assalomu alaykum! TizimLab bildirishnoma botiga xush kelibsiz.\n\nHisobingizni ulash uchun TizimLab veb-saytidagi <b>Profilingiz</b>ga kiring va <b>"Telegram ulash"</b> tugmasini bosing.`,
        ru: `Здравствуйте! Добро пожаловать в бот уведомлений TizimLab.\n\nЧтобы привязать аккаунт, перейдите в свой <b>Профиль</b> в веб-интерфейсе TizimLab и нажмите <b>«Привязать Telegram»</b>.`,
        en: `Hello! Welcome to the TizimLab notification bot.\n\nTo link your account, go to your <b>Profile</b> in the TizimLab web app and click <b>"Link Telegram"</b>.`,
      };
      await ctx.reply(messages[lang], { parse_mode: 'HTML' });
    }
  });

  // /status buyrug'i
  bot.command('status', async (ctx) => {
    if (!ctx.from) return;
    const lang = getLang(ctx.from.language_code);
    const user = await getUserByChatId(ctx.from.id);

    if (user) {
      const formattedDate = user.linkedAt.toISOString().slice(0, 10);
      const messages = {
        uz: `ℹ️ <b>Akkaunt holati:</b> Ulangan\n👤 <b>Foydalanuvchi:</b> ${user.fullName}\n📧 <b>Email:</b> ${user.email}\n💼 <b>Rol:</b> ${user.role}${user.companyName ? `\n🏢 <b>Tashkilot:</b> ${user.companyName}` : ''}\n📅 <b>Ulangan sana:</b> ${formattedDate}`,
        ru: `ℹ️ <b>Статус аккаунта:</b> Привязан\n👤 <b>Пользователь:</b> ${user.fullName}\n📧 <b>Email:</b> ${user.email}\n💼 <b>Роль:</b> ${user.role}${user.companyName ? `\n🏢 <b>Организация:</b> ${user.companyName}` : ''}\n📅 <b>Дата привязки:</b> ${formattedDate}`,
        en: `ℹ️ <b>Account status:</b> Linked\n👤 <b>User:</b> ${user.fullName}\n📧 <b>Email:</b> ${user.email}\n💼 <b>Role:</b> ${user.role}${user.companyName ? `\n🏢 <b>Company:</b> ${user.companyName}` : ''}\n📅 <b>Linked date:</b> ${formattedDate}`,
      };
      await ctx.reply(messages[lang], { parse_mode: 'HTML' });
    } else {
      const messages = {
        uz: "⚠️ <b>Akkaunt ulanmagan.</b>\nUlash uchun TizimLab profilidan foydalaning.",
        ru: '⚠️ <b>Аккаунт не привязан.</b>\nДля привязки перейдите в профиль TizimLab.',
        en: '⚠️ <b>Account not linked.</b>\nUse your TizimLab profile to link.',
      };
      await ctx.reply(messages[lang], { parse_mode: 'HTML' });
    }
  });

  // /unlink buyrug'i
  bot.command('unlink', async (ctx) => {
    if (!ctx.from) return;
    const lang = getLang(ctx.from.language_code);
    const res = await unlinkByChatId(ctx.from.id);

    if (res.success) {
      const messages = {
        uz: `✅ Telegram hisobingiz (${res.user?.fullName}) TizimLab profilidan uzildi.`,
        ru: `✅ Ваш Telegram аккаунт (${res.user?.fullName}) успешно отвязан от TizimLab.`,
        en: `✅ Your Telegram account (${res.user?.fullName}) has been unlinked from TizimLab.`,
      };
      await ctx.reply(messages[lang]);
    } else {
      const messages = {
        uz: "ℹ️ Bu Telegram akkaunti hech qaysi profilga ulanmagan.",
        ru: 'ℹ️ Этот Telegram аккаунт не был привязан к профилю.',
        en: 'ℹ️ This Telegram account was not linked to any profile.',
      };
      await ctx.reply(messages[lang]);
    }
  });

  // /app buyrug'i: WebApp ochish (P14, D-166)
  bot.command('app', async (ctx) => {
    const lang = getLang(ctx.from?.language_code);
    const messages = {
      uz: '📱 <b>TizimLab LIMS WebApp:</b>\nIlovani ochish uchun quyidagi tugmani bosing.',
      ru: '📱 <b>TizimLab LIMS WebApp:</b>\nНажмите кнопку ниже, чтобы открыть приложение.',
      en: '📱 <b>TizimLab LIMS WebApp:</b>\nClick the button below to open the application.',
    };
    const buttonText = {
      uz: 'LIMS ni ochish',
      ru: 'Открыть LIMS',
      en: 'Open LIMS',
    };

    if (webAppUrl && webAppUrl.startsWith('https://')) {
      const keyboard = new InlineKeyboard().webApp(buttonText[lang], webAppUrl);
      await ctx.reply(messages[lang], { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(
        lang === 'ru'
          ? '⚠️ WebApp URL hali sozlanmagan.'
          : lang === 'en'
            ? '⚠️ WebApp URL is not configured yet.'
            : "⚠️ WebApp manzili hali sozlanmagan.",
      );
    }
  });

  // /help buyrug'i
  bot.command('help', async (ctx) => {
    const lang = getLang(ctx.from?.language_code);
    const messages = {
      uz: `📋 <b>Buyruqlar ro'yxati:</b>\n\n/start - Botni ishga tushirish\n/app - TizimLab LIMS ilovasini ochish\n/status - Akkaunt holatini tekshirish\n/unlink - Akkauntni TizimLab profilidan uzish\n/help - Yordam ma'lumoti`,
      ru: `📋 <b>Список команд:</b>\n\n/start - Запуск бота\n/app - Открыть приложение TizimLab LIMS\n/status - Проверка статуса аккаунта\n/unlink - Отвязать аккаунт от TizimLab\n/help - Справка`,
      en: `📋 <b>Commands:</b>\n\n/start - Start bot\n/app - Open TizimLab LIMS app\n/status - Check account status\n/unlink - Unlink account from TizimLab\n/help - Help information`,
    };
    await ctx.reply(messages[lang], { parse_mode: 'HTML', reply_markup: undefined });
  });

  return bot;
}

let runningBot: Bot | null = null;

export function getTelegramBot(): Bot | null {
  return runningBot;
}

/**
 * Server ishga tushganda botni boshlash (R-TG-14, R-TG-15, R-TG-17).
 * TELEGRAM_BOT_TOKEN bo'lmasa — bot ishga tushmaydi, ilova xatosiz ishlayveradi.
 */
export function startTelegramBot(env: Env): Bot | null {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.info("TELEGRAM_BOT_TOKEN berilmagan: Telegram bot o'chiq rejimda.");
    return null;
  }

  const webAppUrl =
    env.TELEGRAM_WEBAPP_URL ||
    (env.FRONTEND_URL?.startsWith('https://') ? env.FRONTEND_URL : undefined) ||
    (env.NODE_ENV === 'production' ? 'https://lab.tizimlab.uz' : undefined);

  const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN, webAppUrl);
  runningBot = bot;
  setTelegramWebAppUrl(webAppUrl ?? null);

  // Xabarnoma yuboruvchini sozlash
  setTelegramSender({
    sendMessage: async (chatId, text, opts) => {
      await bot.api.sendMessage(chatId, text, {
        parse_mode: (opts?.parse_mode as 'HTML') || 'HTML',
        reply_markup: opts?.reply_markup,
      });
    },
  });

  // Telegram menyu tugmasini sozlash (setChatMenuButton, P14)
  if (webAppUrl && webAppUrl.startsWith('https://')) {
    bot.api
      .setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: 'TizimLab',
          web_app: { url: webAppUrl },
        },
      })
      .catch((err) => {
        logger.warn("setChatMenuButton o'rnatilmadi:", { err });
      });
  }

  // Production va webhook sozlamasi bo'lsa polling boshlamaymiz
  if (env.NODE_ENV === 'production' && env.TELEGRAM_WEBHOOK_URL) {
    logger.info(`Telegram bot webhook rejimida: ${env.TELEGRAM_WEBHOOK_URL}`);
    return bot;
  }

  // Test muhitida polling yurgizilmaydi
  if (env.NODE_ENV === 'test') {
    return bot;
  }

  // Development: Polling rejimida ishga tushirish (R-TG-14)
  bot.start({
    onStart: (botInfo) => {
      logger.info(`Telegram bot polling rejimida ishga tushdi: @${botInfo.username}`);
    },
  }).catch((err) => {
    logger.error("Telegram bot polling xatosi:", { err });
  });

  return bot;
}

export function stopTelegramBot(): void {
  if (runningBot) {
    try {
      runningBot.stop();
    } catch (err) {
      logger.error("Telegram bot to'xtatish xatosi:", { err });
    }
    runningBot = null;
    setTelegramSender(null);
    setTelegramWebAppUrl(null);
  }
}
