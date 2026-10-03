"use client";

import { Page } from "@/components/Page";
import { Label } from "@/components/ui/Primitives";
import { CONTACT_EMAIL } from "@/lib/site";
import { useI18n } from "@/lib/i18n";

interface Section { id: string; title: string; items: string[] }

const EN: Section[] = [
  { id: "terms", title: "Terms of service", items: [
    "STAIRTAP is an AI tool that turns an idea into a startup blueprint, a landing page and a public waitlist page. You need an account to use it.",
    "You are responsible for what you generate and publish. Do not use the service for anything illegal, deceptive, hateful or that infringes someone else's rights. We may remove published pages and suspend accounts that do.",
    "AI output can be wrong or incomplete. Check facts, claims and legal obligations before you rely on it or publish it. We make no promise about business results.",
    "Plans give a monthly number of generations. The allowance resets on the 1st of each month; purchased generation packs do not expire. We may change limits and prices with notice on this site.",
    "The service is provided as is, without warranties. To the extent the law allows, our liability is limited to the amount you paid in the last 3 months.",
  ] },
  { id: "privacy", title: "Privacy", items: [
    "We store your email, name, a salted hash of your password, and the ideas, blueprints, pages and history you create.",
    "The text you submit to generate content is sent to Google's Gemini API. Do not submit secrets or personal data of other people.",
    "Payments are handled by Lemon Squeezy (cards) and NOWPayments (crypto). We never see or store card numbers.",
    "Published pages are public. Emails that visitors enter in a page's waitlist form are stored for you, the owner of that page; you are responsible for using them lawfully.",
    "We use one essential cookie to keep you signed in. There is no advertising or third-party tracking.",
    "You can delete your account in Settings → Security. This removes your data and published pages.",
  ] },
  { id: "refunds", title: "Refunds", items: [
    "Subscriptions can be cancelled at any time; access continues until the end of the paid period.",
    "If you are not satisfied, write to us within 14 days of your first payment and we will refund it, provided you have used fewer than 10% of the generations.",
    "Generation packs and crypto payments are refunded only in case of a technical failure on our side.",
  ] },
];

const RU: Section[] = [
  { id: "terms", title: "Условия использования", items: [
    "STAIRTAP — ИИ-инструмент, который превращает идею в план стартапа, лендинг и публичную страницу с листом ожидания. Для работы нужен аккаунт.",
    "Вы отвечаете за то, что создаёте и публикуете. Нельзя использовать сервис для незаконных, обманных, враждебных целей и для нарушения чужих прав. Мы можем удалять такие страницы и блокировать аккаунты.",
    "Ответы ИИ могут быть неточными или неполными. Проверяйте факты, утверждения и юридические требования, прежде чем опираться на результат или публиковать его. Мы не обещаем бизнес-результатов.",
    "Тарифы дают месячное число генераций. Лимит обновляется 1-го числа каждого месяца; купленные пакеты генераций не сгорают. Лимиты и цены могут меняться с уведомлением на этом сайте.",
    "Сервис предоставляется «как есть», без гарантий. В пределах, допустимых законом, наша ответственность ограничена суммой, которую вы заплатили за последние 3 месяца.",
  ] },
  { id: "privacy", title: "Конфиденциальность", items: [
    "Мы храним вашу почту, имя, соль и хэш пароля, а также идеи, планы, страницы и историю, которые вы создаёте.",
    "Текст, который вы отправляете для генерации, передаётся в Gemini API компании Google. Не отправляйте секреты и персональные данные других людей.",
    "Платежи обрабатывают Lemon Squeezy (карты) и NOWPayments (крипто). Номера карт мы не видим и не храним.",
    "Опубликованные страницы общедоступны. Адреса почты, которые посетители вводят в форму листа ожидания, сохраняются для вас как владельца страницы; вы отвечаете за их законное использование.",
    "Мы используем один необходимый cookie, чтобы вы оставались в системе. Рекламы и сторонней аналитики нет.",
    "Аккаунт можно удалить в «Настройки → Безопасность». Данные и опубликованные страницы будут удалены.",
  ] },
  { id: "refunds", title: "Возвраты", items: [
    "Подписку можно отменить в любой момент; доступ сохраняется до конца оплаченного периода.",
    "Если вас что-то не устроило, напишите нам в течение 14 дней после первой оплаты — мы вернём деньги, если использовано менее 10% генераций.",
    "Пакеты генераций и платежи криптой возвращаются только при технической ошибке с нашей стороны.",
  ] },
];

export default function LegalPage() {
  const { t, lang } = useI18n();
  const doc = lang === "ru" ? RU : EN;
  return (
    <Page className="max-w-190">
      <Label>{t("Legal")}</Label>
      <h1 className="mt-2.5 font-display text-[clamp(28px,4.2vw,46px)] leading-[1.08] font-semibold tracking-[-0.03em]">{t("Terms, privacy and refunds")}</h1>
      {doc.map((sec) => (
        <section key={sec.id} id={sec.id} className="mt-10 scroll-mt-24">
          <h2 className="font-display text-[24px] font-semibold tracking-tight">{sec.title}</h2>
          <ul className="list-stair mt-3">{sec.items.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
      ))}
      {CONTACT_EMAIL && <p className="mt-10 text-tx2">{t("Contact")}: <a className="text-tx underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>}
    </Page>
  );
}
