// Подготовка паспорта к границе wasm — ЧИСТАЯ трансформация без node-зависимостей:
// её импортируют и node-движок (engine.mjs → golden-сверка), и браузерное демо
// (apps/docs). Один код — один канон: расхождение путей загрузки уже роняло
// ночной E2E (демо кормило ядро сырым паспортом и падало на alias-валидации).

/**
 * Развернуть дисковый паспорт в конфиг, который понимает ядро.
 *
 * Компонентный слой (юзкейсы-переназначения, напр. пары бейджа — закон пары
 * ядра) на диске отделён от семантики (гигиена трёх уровней). Ядро его как
 * ключ не знает: иммутабельно снимаем `components` (omit через rest, без
 * мутирующего delete — правило Biome noDelete) и вливаем его роли в roles.
 * Движок видит единый набор и вычисляет их идентично, а паспорт держит слои
 * раздельно; порядок ключей/ролей сохранён → отпечаток паспорта не дрейфует.
 */
export function prepareEngineConfig(parsed) {
  const { components, ...config } = parsed;
  if (Array.isArray(components)) {
    config.roles = [...config.roles, ...components];
  }
  // Флаги вместо веток: лист с полем `flag` несёт ОДИН смысл, а тема/состояние —
  // ось-флаг. Резолвер разворачивает его НА МЕСТЕ в конкретные роли на границе
  // wasm (ядро флаг как ключ не знает). `flag.pick: [v…]` — ось нейтрального
  // pick: badge-fill-static + [dark,light] → badge-fill-static-dark/-light с
  // source.pick=v. Порядок значений = порядок разворота → канонический DTO
  // (и отпечаток) байт-идентичен старым явным листьям: свёртка — не дрейф вывода.
  config.roles = expandFlags(config.roles);
  return config;
}

/** Развернуть роли с полем `flag` в конкретные листья (флаг снимается через
 * rest-omit, без мутирующего delete — правило Biome noDelete). Роли без флага
 * проходят как есть; порядок сохранён. */
function expandFlags(roles) {
  return roles.flatMap((role) => {
    const { flag, ...base } = role;
    if (!flag) return [base];
    if (!Array.isArray(flag.pick)) {
      throw new Error(
        `роль ${base.name}: поддержан только флаг pick:[…], получено ${JSON.stringify(flag)}`,
      );
    }
    return flag.pick.map((pick) => ({
      ...base,
      name: `${base.name}-${pick}`,
      recipe: { ...base.recipe, source: { ...base.recipe.source, pick } },
    }));
  });
}
