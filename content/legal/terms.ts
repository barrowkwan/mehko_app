import type { Locale } from "@/lib/locale";
import type { LegalDoc } from "./types";

// ⚠ Drafted by an AI model from what the app actually does. It is NOT legal advice: have it reviewed by
// a qualified person for your jurisdiction before relying on it (see docs/legal-pages.md).

const en: LegalDoc = {
  title: "Terms of Service",
  intro: "These Terms govern your use of Neighborhood Eats. Please read them carefully. Last updated: {updated}.",
  sections: [
    {
      id: "acceptance",
      title: "Accepting these Terms",
      blocks: [{ p: "By creating an account or using Neighborhood Eats (the \"service\"), you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the service." }],
    },
    {
      id: "the-service",
      title: "What the service is",
      blocks: [
        {
          p: "The service is a platform that connects local food merchants with customers. Merchants publish offerings (food, pickup date and place, order cutoff); customers pre-order and pick up. {operator} provides the platform only. We do not prepare, sell, inspect or deliver food, and we are not a party to the sale between a merchant and a customer.",
        },
      ],
    },
    {
      id: "accounts",
      title: "Accounts",
      blocks: [
        {
          ul: [
            "You sign in with a third-party provider (Google, Facebook, GitHub or Apple). You must be at least 13 years old, and merchants must be of legal age to run a food business where they operate.",
            "Keep your information accurate and your sign-in secure.",
            "You are responsible for everything done with your account.",
            "One person, one account.",
            "We may suspend accounts that break these Terms.",
            "You can delete your account at any time from the Account page.",
          ],
        },
      ],
    },
    {
      id: "customers",
      title: "If you are a customer",
      blocks: [
        {
          ul: [
            "You can place an order until the offering's cutoff time.",
            "You can edit or cancel your order until the cutoff. After the cutoff it is final.",
            "Pick up your order at the pickup point during the pickup window and show your order's QR code to the merchant.",
            "If you do not pick up an order, the merchant may be unable to resell it, and may decline future orders from you.",
            "Read item descriptions and ask the merchant about ingredients, allergens and dietary needs before ordering.",
            "Payment and any refunds are arranged directly with the merchant.",
          ],
        },
      ],
    },
    {
      id: "merchants",
      title: "If you are a merchant",
      blocks: [
        {
          ul: [
            "You are the seller. You are responsible for complying with all laws that apply to your food business, including licenses and permits, food safety, labeling, allergen rules, home-kitchen or cottage-food rules, and taxes.",
            "Your listings must be accurate: descriptions, ingredients, allergens, quantities, prices and pickup details.",
            "Fulfil confirmed orders, or tell customers promptly if you cannot.",
            "Use only pickup points that you may lawfully use and that are safe for customers.",
            "Respect the cutoff you set and the orders placed before it.",
            "You are responsible for the quality and safety of your food and for resolving problems and refunds with your customers.",
          ],
        },
      ],
    },
    {
      id: "food-safety",
      title: "Food allergies and safety",
      blocks: [
        {
          p: "Listings are written by merchants. We do not verify ingredients, allergen information or food safety practices. If you have an allergy or dietary restriction, ask the merchant before ordering. We are not responsible for allergic reactions, food-borne illness or other harm from food.",
        },
      ],
    },
    {
      id: "payments",
      title: "Payments and fees",
      blocks: [
        {
          p: "The service does not process payments and currently charges no fees. Prices, payment methods (for example cash, Venmo or Zelle), refunds and disputes are between the customer and the merchant. If we add paid features in the future, we will update these Terms and give notice first.",
        },
      ],
    },
    {
      id: "location-sharing",
      title: "Live location sharing",
      blocks: [
        {
          p: "Merchants may optionally share their live location on the pickup day. Share only your own location, only while you are present for the pickup, and stop sharing afterwards. Customers must not misuse a merchant's location, for example to follow or harass them.",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      blocks: [
        { p: "You agree not to:" },
        {
          ul: [
            "break the law or sell goods that are illegal or unsafe,",
            "post content that is unlawful, misleading, hateful or that infringes others' rights, or impersonate anyone,",
            "access other people's data, probe or disrupt the service, or bypass its limits,",
            "abuse ordering, for example by placing orders you do not intend to pick up in order to hold stock,",
            "scrape the service or use automated means that burden it.",
          ],
        },
      ],
    },
    {
      id: "content",
      title: "Your content",
      blocks: [
        {
          p: "You keep ownership of the content you submit (for example business descriptions, foods and translations). You give us a limited license to host, display and format it as needed to operate the service, and you promise that you have the right to submit it.",
        },
      ],
    },
    {
      id: "availability",
      title: "Availability and changes",
      blocks: [
        { p: "We aim to keep the service available, but it is provided on a best-effort basis and may be interrupted, changed or limited, for example for maintenance or because of limits of our providers. We may change or discontinue features." },
      ],
    },
    {
      id: "termination",
      title: "Ending your use",
      blocks: [
        {
          p: "You may stop using the service and delete your account at any time. We may suspend or end access if you breach these Terms or misuse the service. Provisions that by their nature should continue, such as disclaimers and limits of liability, continue after termination.",
        },
      ],
    },
    {
      id: "disclaimers",
      title: "Disclaimers",
      blocks: [
        {
          p: "To the extent permitted by law, the service is provided \"as is\" and \"as available\", without warranties of any kind. We do not guarantee that merchants' food is safe, accurate or available, or that the service will be error-free or uninterrupted.",
        },
      ],
    },
    {
      id: "liability",
      title: "Limitation of liability",
      blocks: [
        {
          p: "To the extent permitted by law, {operator} is not liable for indirect, incidental, special or consequential damages, or for loss arising from transactions between merchants and customers, food-related illness or injury, or missed pickups. Where liability cannot be excluded, it is limited to the greater of the amount you paid us in the previous 12 months (currently none) or US$50. Nothing in these Terms limits liability that cannot be limited by law.",
        },
      ],
    },
    {
      id: "governing-law",
      title: "Governing law",
      blocks: [
        {
          p: "These Terms are governed by the laws of the place where {operator} is based, without regard to conflict-of-law rules, and disputes will be handled by the courts there, unless mandatory consumer protection law where you live provides otherwise.",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to these Terms",
      blocks: [{ p: "We may update these Terms. The date at the top shows the latest version. If you keep using the service after an update, you accept the new Terms; we will give notice in the service of material changes." }],
    },
    { id: "contact", title: "Contact", blocks: [{ p: "Questions about these Terms: {contact}." }] },
  ],
};

const es: LegalDoc = {
  title: "Términos del servicio",
  intro: "Estos Términos regulan el uso de Neighborhood Eats. Léelos con atención. Última actualización: {updated}.",
  sections: [
    {
      id: "acceptance",
      title: "Aceptación de estos Términos",
      blocks: [{ p: "Al crear una cuenta o usar Neighborhood Eats (el \"servicio\"), aceptas estos Términos y nuestra Política de privacidad. Si no estás de acuerdo, no uses el servicio." }],
    },
    {
      id: "the-service",
      title: "Qué es el servicio",
      blocks: [
        {
          p: "El servicio es una plataforma que conecta a comerciantes locales de comida con clientes. Los comerciantes publican ofertas (comida, fecha y lugar de recogida, cierre de pedidos); los clientes piden por adelantado y recogen. {operator} solo proporciona la plataforma. No preparamos, vendemos, inspeccionamos ni entregamos comida, y no somos parte de la venta entre un comerciante y un cliente.",
        },
      ],
    },
    {
      id: "accounts",
      title: "Cuentas",
      blocks: [
        {
          ul: [
            "Inicias sesión con un proveedor externo (Google, Facebook, GitHub o Apple). Debes tener al menos 13 años, y los comerciantes deben tener la edad legal para dirigir un negocio de comida donde operan.",
            "Mantén tus datos correctos y tu acceso seguro.",
            "Eres responsable de todo lo que se haga con tu cuenta.",
            "Una persona, una cuenta.",
            "Podemos suspender cuentas que incumplan estos Términos.",
            "Puedes eliminar tu cuenta en cualquier momento desde la página Cuenta.",
          ],
        },
      ],
    },
    {
      id: "customers",
      title: "Si eres cliente",
      blocks: [
        {
          ul: [
            "Puedes hacer un pedido hasta la hora de cierre de la oferta.",
            "Puedes modificar o cancelar tu pedido hasta el cierre. Después del cierre es definitivo.",
            "Recoge tu pedido en el punto de recogida durante el horario de recogida y muestra el código QR de tu pedido al comerciante.",
            "Si no recoges un pedido, el comerciante puede no poder revenderlo y puede rechazar pedidos futuros tuyos.",
            "Lee las descripciones y pregunta al comerciante por ingredientes, alérgenos y necesidades dietéticas antes de pedir.",
            "El pago y los posibles reembolsos se acuerdan directamente con el comerciante.",
          ],
        },
      ],
    },
    {
      id: "merchants",
      title: "Si eres comerciante",
      blocks: [
        {
          ul: [
            "Tú eres el vendedor. Eres responsable de cumplir todas las leyes aplicables a tu negocio de comida, incluidas licencias y permisos, seguridad alimentaria, etiquetado, normas de alérgenos, normas de cocina doméstica y artesanal, e impuestos.",
            "Tus ofertas deben ser exactas: descripciones, ingredientes, alérgenos, cantidades, precios y datos de recogida.",
            "Cumple los pedidos confirmados o avisa a los clientes de inmediato si no puedes.",
            "Usa solo puntos de recogida que puedas usar legalmente y que sean seguros para los clientes.",
            "Respeta el cierre que fijes y los pedidos hechos antes de él.",
            "Eres responsable de la calidad y la seguridad de tu comida y de resolver problemas y reembolsos con tus clientes.",
          ],
        },
      ],
    },
    {
      id: "food-safety",
      title: "Alergias y seguridad alimentaria",
      blocks: [
        {
          p: "Las ofertas las redactan los comerciantes. No verificamos ingredientes, información de alérgenos ni prácticas de seguridad alimentaria. Si tienes una alergia o restricción dietética, pregunta al comerciante antes de pedir. No somos responsables de reacciones alérgicas, intoxicaciones alimentarias ni otros daños causados por la comida.",
        },
      ],
    },
    {
      id: "payments",
      title: "Pagos y tarifas",
      blocks: [
        {
          p: "El servicio no procesa pagos y actualmente no cobra tarifas. Los precios, los métodos de pago (por ejemplo efectivo, Venmo o Zelle), los reembolsos y las disputas son entre el cliente y el comerciante. Si en el futuro añadimos funciones de pago, actualizaremos estos Términos y avisaremos antes.",
        },
      ],
    },
    {
      id: "location-sharing",
      title: "Ubicación en vivo",
      blocks: [
        {
          p: "Los comerciantes pueden compartir opcionalmente su ubicación en vivo el día de la recogida. Comparte solo tu propia ubicación, solo mientras estés presente para la recogida, y deja de compartir después. Los clientes no deben hacer un mal uso de la ubicación de un comerciante, por ejemplo para seguirlo o acosarlo.",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "Uso aceptable",
      blocks: [
        { p: "Te comprometes a no:" },
        {
          ul: [
            "infringir la ley ni vender productos ilegales o inseguros,",
            "publicar contenido ilícito, engañoso, de odio o que infrinja derechos de otros, ni suplantar a nadie,",
            "acceder a datos de otras personas, sondear o interrumpir el servicio ni eludir sus límites,",
            "abusar de los pedidos, por ejemplo haciendo pedidos que no piensas recoger para reservar existencias,",
            "extraer datos del servicio ni usar medios automáticos que lo sobrecarguen.",
          ],
        },
      ],
    },
    {
      id: "content",
      title: "Tu contenido",
      blocks: [
        {
          p: "Conservas la propiedad del contenido que envíes (por ejemplo descripciones del negocio, comidas y traducciones). Nos concedes una licencia limitada para alojarlo, mostrarlo y darle formato según sea necesario para operar el servicio, y garantizas que tienes derecho a enviarlo.",
        },
      ],
    },
    {
      id: "availability",
      title: "Disponibilidad y cambios",
      blocks: [
        { p: "Procuramos mantener el servicio disponible, pero se ofrece en la medida de lo posible y puede interrumpirse, cambiar o limitarse, por ejemplo por mantenimiento o por límites de nuestros proveedores. Podemos cambiar o dejar de ofrecer funciones." },
      ],
    },
    {
      id: "termination",
      title: "Terminar el uso",
      blocks: [
        {
          p: "Puedes dejar de usar el servicio y eliminar tu cuenta en cualquier momento. Podemos suspender o finalizar el acceso si incumples estos Términos o haces un mal uso del servicio. Las disposiciones que por su naturaleza deban continuar, como las renuncias y los límites de responsabilidad, siguen vigentes tras la terminación.",
        },
      ],
    },
    {
      id: "disclaimers",
      title: "Exenciones de garantía",
      blocks: [
        {
          p: "En la medida permitida por la ley, el servicio se ofrece \"tal cual\" y \"según disponibilidad\", sin garantías de ningún tipo. No garantizamos que la comida de los comerciantes sea segura, exacta o esté disponible, ni que el servicio esté libre de errores o sin interrupciones.",
        },
      ],
    },
    {
      id: "liability",
      title: "Limitación de responsabilidad",
      blocks: [
        {
          p: "En la medida permitida por la ley, {operator} no es responsable de daños indirectos, incidentales, especiales o consecuentes, ni de pérdidas derivadas de transacciones entre comerciantes y clientes, de enfermedades o lesiones relacionadas con la comida, o de recogidas perdidas. Cuando la responsabilidad no pueda excluirse, se limita al mayor de los importes que nos hayas pagado en los 12 meses anteriores (actualmente ninguno) o 50 USD. Nada en estos Términos limita una responsabilidad que la ley no permita limitar.",
        },
      ],
    },
    {
      id: "governing-law",
      title: "Ley aplicable",
      blocks: [
        {
          p: "Estos Términos se rigen por las leyes del lugar donde tiene su sede {operator}, sin tener en cuenta las normas de conflicto de leyes, y las disputas se resolverán en los tribunales de ese lugar, salvo que la ley imperativa de protección del consumidor de tu país disponga otra cosa.",
        },
      ],
    },
    {
      id: "changes",
      title: "Cambios en estos Términos",
      blocks: [{ p: "Podemos actualizar estos Términos. La fecha al principio indica la versión más reciente. Si sigues usando el servicio tras una actualización, aceptas los nuevos Términos; avisaremos en el servicio de los cambios importantes." }],
    },
    { id: "contact", title: "Contacto", blocks: [{ p: "Preguntas sobre estos Términos: {contact}." }] },
  ],
};

const zhCN: LegalDoc = {
  title: "服务条款",
  intro: "本条款适用于您对 Neighborhood Eats 的使用。请仔细阅读。最后更新：{updated}。",
  sections: [
    {
      id: "acceptance",
      title: "接受本条款",
      blocks: [{ p: "创建账户或使用 Neighborhood Eats（“本服务”），即表示您同意本条款和我们的隐私政策。如果您不同意，请勿使用本服务。" }],
    },
    {
      id: "the-service",
      title: "本服务是什么",
      blocks: [
        {
          p: "本服务是一个连接本地美食商家与顾客的平台。商家发布售卖场次（菜品、自取日期和地点、下单截止时间），顾客提前预订并自取。{operator} 仅提供平台。我们不制作、销售、检查或配送食品，也不是商家与顾客之间买卖的当事方。",
        },
      ],
    },
    {
      id: "accounts",
      title: "账户",
      blocks: [
        {
          ul: [
            "您通过第三方提供方（Google、Facebook、GitHub 或 Apple）登录。您必须年满 13 周岁，商家必须达到其经营地开展食品业务所需的法定年龄。",
            "请保持您的信息准确，并确保登录安全。",
            "您须对通过您账户进行的一切行为负责。",
            "一人一个账户。",
            "我们可以暂停违反本条款的账户。",
            "您可以随时在“账户”页面删除您的账户。",
          ],
        },
      ],
    },
    {
      id: "customers",
      title: "如果您是顾客",
      blocks: [
        {
          ul: [
            "您可以在售卖场次的截止时间之前下单。",
            "您可以在截止时间之前修改或取消订单。截止之后订单即为最终。",
            "请在自取时段内到自取点取餐，并向商家出示订单的二维码。",
            "如果您未取餐，商家可能无法再次出售，并可能拒绝您今后的订单。",
            "下单前请阅读商品说明，并向商家询问成分、过敏原和饮食需求。",
            "付款及任何退款均由您与商家直接商定。",
          ],
        },
      ],
    },
    {
      id: "merchants",
      title: "如果您是商家",
      blocks: [
        {
          ul: [
            "您是卖方。您须遵守适用于您食品业务的所有法律，包括执照和许可、食品安全、标签、过敏原规定、家庭厨房或小作坊食品规定以及税务。",
            "您的发布信息必须准确：说明、成分、过敏原、数量、价格和自取信息。",
            "履行已确认的订单；如无法履行，请立即告知顾客。",
            "只使用您可合法使用且对顾客安全的自取点。",
            "遵守您设定的截止时间以及在此之前下的订单。",
            "您须对食品的质量和安全负责，并负责与顾客解决问题和退款。",
          ],
        },
      ],
    },
    {
      id: "food-safety",
      title: "食物过敏与安全",
      blocks: [
        {
          p: "发布内容由商家撰写。我们不核实成分、过敏原信息或食品安全做法。如果您有过敏或饮食限制，请在下单前询问商家。对于过敏反应、食源性疾病或食品造成的其他伤害，我们不承担责任。",
        },
      ],
    },
    {
      id: "payments",
      title: "付款与费用",
      blocks: [
        {
          p: "本服务不处理付款，目前不收取任何费用。价格、付款方式（例如现金、Venmo 或 Zelle）、退款和争议均由顾客与商家之间解决。如果我们将来增加付费功能，会先更新本条款并提前通知。",
        },
      ],
    },
    {
      id: "location-sharing",
      title: "实时位置共享",
      blocks: [
        {
          p: "商家可以选择在自取当天共享实时位置。请只共享您自己的位置，只在您为自取到场期间共享，并在之后停止共享。顾客不得滥用商家的位置信息，例如跟踪或骚扰商家。",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "可接受的使用",
      blocks: [
        { p: "您同意不：" },
        {
          ul: [
            "违反法律或出售违法或不安全的商品，",
            "发布违法、误导、仇恨或侵犯他人权利的内容，或冒充他人，",
            "访问他人的数据、探测或干扰本服务，或绕过其限制，",
            "滥用下单功能，例如下自己不打算取的订单以占用库存，",
            "抓取本服务内容或使用会给其造成负担的自动化手段。",
          ],
        },
      ],
    },
    {
      id: "content",
      title: "您的内容",
      blocks: [
        {
          p: "您保留所提交内容（例如商家简介、菜品和翻译）的所有权。您授予我们为运营本服务所需而托管、显示和排版这些内容的有限许可，并保证您有权提交这些内容。",
        },
      ],
    },
    {
      id: "availability",
      title: "可用性与变更",
      blocks: [
        { p: "我们力求保持服务可用，但服务按尽力而为的方式提供，可能因维护或服务提供方的限制而中断、变更或受限。我们可能变更或停止某些功能。" },
      ],
    },
    {
      id: "termination",
      title: "终止使用",
      blocks: [
        {
          p: "您可以随时停止使用本服务并删除账户。如果您违反本条款或滥用本服务，我们可以暂停或终止您的访问。依其性质应继续有效的条款（例如免责声明和责任限制）在终止后继续有效。",
        },
      ],
    },
    {
      id: "disclaimers",
      title: "免责声明",
      blocks: [
        {
          p: "在法律允许的范围内，本服务按“现状”和“可用”的状态提供，不附带任何形式的保证。我们不保证商家的食品安全、准确或可供应，也不保证本服务无错误或不间断。",
        },
      ],
    },
    {
      id: "liability",
      title: "责任限制",
      blocks: [
        {
          p: "在法律允许的范围内，{operator} 对间接、附带、特殊或后果性损害，以及因商家与顾客之间的交易、与食品相关的疾病或伤害、或错过取餐而产生的损失不承担责任。如责任无法排除，则以您在过去 12 个月内向我们支付的金额（目前为零）与 50 美元中的较高者为限。本条款中的任何内容均不限制法律上无法限制的责任。",
        },
      ],
    },
    {
      id: "governing-law",
      title: "适用法律",
      blocks: [
        {
          p: "本条款受 {operator} 所在地法律管辖（不考虑法律冲突规则），争议由该地的法院处理，但您所在地的强制性消费者保护法另有规定的除外。",
        },
      ],
    },
    {
      id: "changes",
      title: "本条款的变更",
      blocks: [{ p: "我们可能会更新本条款。顶部的日期表示最新版本。如果您在更新后继续使用本服务，即表示接受新条款；重大变更我们会在服务中通知。" }],
    },
    { id: "contact", title: "联系我们", blocks: [{ p: "对本条款的疑问：{contact}。" }] },
  ],
};

const zhTW: LegalDoc = {
  title: "服務條款",
  intro: "本條款適用於您對 Neighborhood Eats 的使用。請仔細閱讀。最後更新：{updated}。",
  sections: [
    {
      id: "acceptance",
      title: "接受本條款",
      blocks: [{ p: "建立帳戶或使用 Neighborhood Eats（「本服務」），即表示您同意本條款和我們的隱私權政策。如果您不同意，請勿使用本服務。" }],
    },
    {
      id: "the-service",
      title: "本服務是什麼",
      blocks: [
        {
          p: "本服務是一個連結在地美食商家與顧客的平台。商家刊登販售場次（餐點、自取日期和地點、下單截止時間），顧客提前預訂並自取。{operator} 僅提供平台。我們不製作、販售、檢查或配送食品，也不是商家與顧客之間買賣的當事方。",
        },
      ],
    },
    {
      id: "accounts",
      title: "帳戶",
      blocks: [
        {
          ul: [
            "您透過第三方提供者（Google、Facebook、GitHub 或 Apple）登入。您必須年滿 13 歲，商家必須達到其營業地經營食品業務所需的法定年齡。",
            "請保持您的資料正確，並確保登入安全。",
            "您須對透過您帳戶進行的一切行為負責。",
            "一人一個帳戶。",
            "我們可以停用違反本條款的帳戶。",
            "您可以隨時在「帳戶」頁面刪除您的帳戶。",
          ],
        },
      ],
    },
    {
      id: "customers",
      title: "如果您是顧客",
      blocks: [
        {
          ul: [
            "您可以在販售場次的截止時間之前下單。",
            "您可以在截止時間之前修改或取消訂單。截止之後訂單即為最終。",
            "請在自取時段內到自取點取餐，並向商家出示訂單的 QR 碼。",
            "如果您未取餐，商家可能無法再次販售，並可能拒絕您日後的訂單。",
            "下單前請閱讀品項說明，並向商家詢問成分、過敏原和飲食需求。",
            "付款及任何退款均由您與商家直接商定。",
          ],
        },
      ],
    },
    {
      id: "merchants",
      title: "如果您是商家",
      blocks: [
        {
          ul: [
            "您是賣方。您須遵守適用於您食品業務的所有法律，包括執照和許可、食品安全、標示、過敏原規定、家庭廚房或小型食品工坊規定以及稅務。",
            "您刊登的資訊必須正確：說明、成分、過敏原、數量、價格和自取資訊。",
            "履行已確認的訂單；如無法履行，請立即告知顧客。",
            "只使用您可合法使用且對顧客安全的自取點。",
            "遵守您設定的截止時間以及在此之前下的訂單。",
            "您須對食品的品質和安全負責，並負責與顧客解決問題和退款。",
          ],
        },
      ],
    },
    {
      id: "food-safety",
      title: "食物過敏與安全",
      blocks: [
        {
          p: "刊登內容由商家撰寫。我們不查核成分、過敏原資訊或食品安全做法。如果您有過敏或飲食限制，請在下單前詢問商家。對於過敏反應、食源性疾病或食品造成的其他傷害，我們不承擔責任。",
        },
      ],
    },
    {
      id: "payments",
      title: "付款與費用",
      blocks: [
        {
          p: "本服務不處理付款，目前不收取任何費用。價格、付款方式（例如現金、Venmo 或 Zelle）、退款和爭議均由顧客與商家之間處理。如果我們日後增加付費功能，會先更新本條款並提前通知。",
        },
      ],
    },
    {
      id: "location-sharing",
      title: "即時位置分享",
      blocks: [
        {
          p: "商家可以選擇在自取當天分享即時位置。請只分享您自己的位置，只在您為自取到場期間分享，並在之後停止分享。顧客不得濫用商家的位置資訊，例如跟蹤或騷擾商家。",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "可接受的使用",
      blocks: [
        { p: "您同意不：" },
        {
          ul: [
            "違反法律或販售違法或不安全的商品，",
            "發布違法、誤導、仇恨或侵害他人權利的內容，或冒充他人，",
            "存取他人的資料、探測或干擾本服務，或繞過其限制，",
            "濫用下單功能，例如下自己不打算取的訂單以占用庫存，",
            "擷取本服務內容或使用會對其造成負擔的自動化方式。",
          ],
        },
      ],
    },
    {
      id: "content",
      title: "您的內容",
      blocks: [
        {
          p: "您保留所提交內容（例如商家簡介、餐點和翻譯）的所有權。您授予我們為營運本服務所需而代管、顯示和排版這些內容的有限授權，並保證您有權提交這些內容。",
        },
      ],
    },
    {
      id: "availability",
      title: "可用性與變更",
      blocks: [
        { p: "我們力求保持服務可用，但服務以盡力而為的方式提供，可能因維護或服務提供者的限制而中斷、變更或受限。我們可能變更或停止某些功能。" },
      ],
    },
    {
      id: "termination",
      title: "終止使用",
      blocks: [
        {
          p: "您可以隨時停止使用本服務並刪除帳戶。如果您違反本條款或濫用本服務，我們可以停用或終止您的存取。依其性質應繼續有效的條款（例如免責聲明和責任限制）在終止後繼續有效。",
        },
      ],
    },
    {
      id: "disclaimers",
      title: "免責聲明",
      blocks: [
        {
          p: "在法律允許的範圍內，本服務依「現狀」和「可用」的狀態提供，不附帶任何形式的保證。我們不保證商家的食品安全、正確或可供應，也不保證本服務無錯誤或不中斷。",
        },
      ],
    },
    {
      id: "liability",
      title: "責任限制",
      blocks: [
        {
          p: "在法律允許的範圍內，{operator} 對間接、附帶、特殊或衍生性損害，以及因商家與顧客之間的交易、與食品相關的疾病或傷害、或錯過取餐而產生的損失不承擔責任。如責任無法排除，則以您在過去 12 個月內向我們支付的金額（目前為零）與 50 美元中較高者為限。本條款中的任何內容均不限制法律上無法限制的責任。",
        },
      ],
    },
    {
      id: "governing-law",
      title: "準據法",
      blocks: [
        {
          p: "本條款受 {operator} 所在地法律管轄（不考慮法律衝突規則），爭議由該地的法院處理，但您所在地的強制性消費者保護法另有規定者除外。",
        },
      ],
    },
    {
      id: "changes",
      title: "本條款的變更",
      blocks: [{ p: "我們可能會更新本條款。頂部的日期表示最新版本。如果您在更新後繼續使用本服務，即表示接受新條款；重大變更我們會在服務中通知。" }],
    },
    { id: "contact", title: "聯絡我們", blocks: [{ p: "對本條款的疑問：{contact}。" }] },
  ],
};

export const terms: Record<Locale, LegalDoc> = { en, es, "zh-CN": zhCN, "zh-TW": zhTW };
