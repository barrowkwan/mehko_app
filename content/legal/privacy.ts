import type { Locale } from "@/lib/locale";
import type { LegalDoc } from "./types";

// ⚠ Drafted by an AI model from what the app actually does. It is NOT legal advice: have it reviewed by
// a qualified person for your jurisdiction before relying on it (see docs/legal-pages.md).

const en: LegalDoc = {
  title: "Privacy Policy",
  intro:
    "Neighborhood Eats lets local food merchants publish what they will sell for pickup, and lets customers pre-order. This policy explains what personal information we handle, why, and the choices you have. Last updated: {updated}.",
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      blocks: [
        { p: "{operator} operates Neighborhood Eats (the \"service\") at {site} and in its mobile apps. For questions about this policy, contact {contact}." },
      ],
    },
    {
      id: "information-we-collect",
      title: "Information we collect",
      blocks: [
        { p: "We collect only what we need to run the service:" },
        {
          ul: [
            "Account information: when you sign in with Google, Facebook, GitHub or Apple, that provider shares your name, email address and profile picture link with us. We never see your password. We also keep a unique account ID.",
            "Preferences: the language you choose.",
            "Orders: the items and quantities you order, their status, timestamps, the offering and pickup point, and the QR code token that proves the order at pickup. If you add a note for the merchant (for example about allergies), it is stored with the order and only you and that merchant can see it.",
            "Merchant information (if you register as a merchant): business name and description, optional logo, website, contact email and phone (shown to signed-in customers), country, pickup points (names, addresses and map coordinates), foods (with optional photos), offerings (with optional pickup instructions), and any translations you write. We remove location data embedded in photos before storing them.",
            "Live location (merchants only, optional): see \"Live location\" below.",
            "Technical information: your IP address and basic device and browser details appear in the server logs of our hosting providers, which we use for security and to keep the service running.",
          ],
        },
        { p: "We do not ask for or store payment card details. We do not collect your precise location as a customer." },
      ],
    },
    {
      id: "location",
      title: "Live location",
      blocks: [
        {
          p: "A merchant may choose to share their live location on the pickup day so customers can see where they are. This is optional and off by default. While it is on, the merchant's device sends its position to us, and we show it only to customers who have an active order for that offering. We keep only the latest position (it is overwritten, not logged as a history), and sharing stops when the merchant turns it off. Sharing can only be turned on on the pickup date.",
        },
      ],
    },
    {
      id: "how-we-use-it",
      title: "How we use information",
      blocks: [
        {
          ul: [
            "To run the service: create and secure your account, let merchants publish offerings, let customers order, edit or cancel before the cutoff, and confirm pickups with the QR code.",
            "To show merchants the names and orders of customers who ordered from them, and to show customers merchants' business details and pickup locations.",
            "To show you the service in your language and to keep you signed in.",
            "To protect the service: prevent abuse, fix problems and keep encrypted backups.",
          ],
        },
        { p: "We do not sell your personal information, and we do not use it for advertising or profiling." },
      ],
    },
    {
      id: "who-we-share-with",
      title: "Who sees or receives your information",
      blocks: [
        {
          ul: [
            "Merchants and customers: merchants see the name, profile picture and orders of people who ordered from them; customers see merchants' business details, foods and pickup points.",
            "Supabase: provides our database, sign-in and real-time features.",
            "Render: hosts the website.",
            "Sign-in providers (Google, Facebook, GitHub, Apple): when you sign in, they tell us who you are, under their own privacy policies.",
            "GitHub: hosts our source code and runs our automated jobs, including encrypted database backups.",
            "Sentry: if error monitoring is enabled, it receives technical error reports (what went wrong and on which page or action). We configure it not to send cookies, request details, your account details or your email address.",
            "Email provider (Resend): if email notifications are enabled, it receives your email address and the content of the emails we send you (order confirmations, pickup reminders and, for merchants, order summaries). You can turn these emails off in Account or with the unsubscribe link in each email.",
            "OpenStreetMap: when you open a map, your device requests map images from OpenStreetMap servers, which can see your IP address and the area you view.",
            "Open-Meteo and Nager.Date: our server asks these services for weather and public holidays for pickup places and dates. No personal information is sent.",
            "Authorities: if required by law.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies and similar technologies",
      blocks: [
        {
          p: "We use only strictly necessary cookies and local storage: one to keep you signed in (a session) and one to remember your language. We do not use advertising, analytics or tracking cookies. In the mobile apps, equivalent information is kept in the app's secure storage.",
        },
      ],
    },
    {
      id: "how-long",
      title: "How long we keep information",
      blocks: [
        {
          p: "We keep your information while your account exists. Orders are kept until you or the merchant's account is deleted. Encrypted backups are kept for up to 30 days, so deleted data can remain in backups for that long before it expires. Hosting providers keep their own logs under their own policies.",
        },
      ],
    },
    {
      id: "deleting-your-data",
      title: "Deleting your account and data",
      blocks: [
        { p: "You can delete your account yourself at any time: sign in, open Account, and choose \"Delete my account permanently\". This removes:" },
        {
          ul: [
            "your profile and sign-in,",
            "all your orders,",
            "if you are a merchant: your foods and their photos, pickup points, offerings and all orders on them (your customers lose that order history).",
          ],
        },
        {
          p: "A merchant with upcoming orders that customers still expect must cancel or complete them first. Deletion cannot be undone. If you cannot sign in, or want a copy of your data, contact {contact}.",
        },
      ],
    },
    {
      id: "your-rights",
      title: "Your rights",
      blocks: [
        {
          p: "Depending on where you live (for example in the EU, UK or California) you may have the right to access, correct, delete or receive a copy of your personal information, and to object to or restrict some uses. Use the in-app deletion above or contact {contact}. You may also complain to your local data protection authority.",
        },
      ],
    },
    {
      id: "security",
      title: "Security",
      blocks: [
        {
          p: "Data is protected in transit with HTTPS, access to data is restricted by database rules so people can only see what they should, and backups are encrypted. No system is perfectly secure, so we cannot guarantee absolute security.",
        },
      ],
    },
    {
      id: "international",
      title: "International transfers",
      blocks: [
        { p: "Our providers operate in several countries, including the United States, so your information may be processed outside the country where you live." },
      ],
    },
    {
      id: "children",
      title: "Children",
      blocks: [
        { p: "The service is not intended for children under 13 (or the higher minimum age in your country). If you believe a child has an account, contact {contact} and we will delete it." },
      ],
    },
    {
      id: "payments",
      title: "Payments",
      blocks: [
        { p: "The service does not process payments or collect payment details. Any payment (for example cash, Venmo or Zelle) is arranged directly between customer and merchant and is subject to those services' own policies." },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [{ p: "We may update this policy. The date at the top shows the latest version, and we will give notice in the service for material changes." }],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [{ p: "Questions or requests about this policy: {contact}." }],
    },
  ],
};

const es: LegalDoc = {
  title: "Política de privacidad",
  intro:
    "Neighborhood Eats permite a comerciantes locales publicar lo que venderán para recoger y a los clientes hacer pedidos anticipados. Esta política explica qué información personal tratamos, por qué y qué opciones tienes. Última actualización: {updated}.",
  sections: [
    {
      id: "who-we-are",
      title: "Quiénes somos",
      blocks: [
        { p: "{operator} opera Neighborhood Eats (el \"servicio\") en {site} y en sus aplicaciones móviles. Para preguntas sobre esta política, escribe a {contact}." },
      ],
    },
    {
      id: "information-we-collect",
      title: "Información que recopilamos",
      blocks: [
        { p: "Solo recopilamos lo necesario para ofrecer el servicio:" },
        {
          ul: [
            "Datos de la cuenta: cuando inicias sesión con Google, Facebook, GitHub o Apple, ese proveedor nos comparte tu nombre, tu correo electrónico y el enlace a tu foto de perfil. Nunca vemos tu contraseña. También guardamos un identificador único de cuenta.",
            "Preferencias: el idioma que elijas.",
            "Pedidos: los artículos y cantidades, su estado, las fechas, la oferta y el punto de recogida, y el código QR que acredita el pedido al recogerlo. Si añades una nota para el comerciante (por ejemplo sobre alergias), se guarda con el pedido y solo tú y ese comerciante podéis verla.",
            "Datos de comerciante (si te registras como comerciante): nombre y descripción del negocio, logotipo, sitio web, correo y teléfono de contacto opcionales (se muestran a los clientes con sesión iniciada), país, puntos de recogida (nombres, direcciones y coordenadas), comidas (con fotos opcionales), ofertas (con instrucciones de recogida opcionales) y las traducciones que escribas. Eliminamos los datos de ubicación incrustados en las fotos antes de guardarlas.",
            "Ubicación en vivo (solo comerciantes, opcional): véase \"Ubicación en vivo\" más abajo.",
            "Información técnica: tu dirección IP y datos básicos del dispositivo y del navegador aparecen en los registros de los servidores de nuestros proveedores de alojamiento, que usamos por seguridad y para mantener el servicio.",
          ],
        },
        { p: "No pedimos ni guardamos datos de tarjetas de pago. No recopilamos tu ubicación precisa como cliente." },
      ],
    },
    {
      id: "location",
      title: "Ubicación en vivo",
      blocks: [
        {
          p: "Un comerciante puede decidir compartir su ubicación en vivo el día de la recogida para que los clientes vean dónde está. Es opcional y está desactivado por defecto. Mientras está activado, el dispositivo del comerciante nos envía su posición y la mostramos solo a los clientes con un pedido activo de esa oferta. Guardamos únicamente la última posición (se sobrescribe, no se conserva un historial) y la función se detiene cuando el comerciante la desactiva. Solo se puede activar en la fecha de la recogida.",
        },
      ],
    },
    {
      id: "how-we-use-it",
      title: "Cómo usamos la información",
      blocks: [
        {
          ul: [
            "Para ofrecer el servicio: crear y proteger tu cuenta, permitir a los comerciantes publicar ofertas, permitir a los clientes pedir, modificar o cancelar antes del cierre y confirmar recogidas con el código QR.",
            "Para mostrar a los comerciantes los nombres y pedidos de los clientes que les han pedido, y a los clientes los datos del negocio y los puntos de recogida de los comerciantes.",
            "Para mostrarte el servicio en tu idioma y mantener tu sesión iniciada.",
            "Para proteger el servicio: prevenir abusos, solucionar problemas y conservar copias de seguridad cifradas.",
          ],
        },
        { p: "No vendemos tu información personal ni la usamos para publicidad ni para crear perfiles." },
      ],
    },
    {
      id: "who-we-share-with",
      title: "Quién ve o recibe tu información",
      blocks: [
        {
          ul: [
            "Comerciantes y clientes: los comerciantes ven el nombre, la foto de perfil y los pedidos de quienes les han pedido; los clientes ven los datos del negocio, las comidas y los puntos de recogida de los comerciantes.",
            "Supabase: proporciona nuestra base de datos, el inicio de sesión y las funciones en tiempo real.",
            "Render: aloja el sitio web.",
            "Proveedores de inicio de sesión (Google, Facebook, GitHub, Apple): al iniciar sesión nos indican quién eres, según sus propias políticas de privacidad.",
            "GitHub: aloja nuestro código fuente y ejecuta nuestras tareas automáticas, incluidas las copias de seguridad cifradas de la base de datos.",
            "Sentry: si la supervisión de errores está activada, recibe informes técnicos de errores (qué falló y en qué página o acción). Lo configuramos para que no envíe cookies, detalles de las solicitudes, los datos de tu cuenta ni tu correo electrónico.",
            "Proveedor de correo (Resend): si las notificaciones por correo están activadas, recibe tu dirección de correo y el contenido de los mensajes que te enviamos (confirmaciones de pedido, recordatorios de recogida y, para comerciantes, resúmenes de pedidos). Puedes desactivarlos en Cuenta o con el enlace para cancelar la suscripción de cada mensaje.",
            "OpenStreetMap: al abrir un mapa, tu dispositivo solicita imágenes del mapa a los servidores de OpenStreetMap, que pueden ver tu dirección IP y la zona que consultas.",
            "Open-Meteo y Nager.Date: nuestro servidor les pide el clima y los festivos de los lugares y fechas de recogida. No se envía información personal.",
            "Autoridades: si lo exige la ley.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies y tecnologías similares",
      blocks: [
        {
          p: "Solo usamos cookies y almacenamiento local estrictamente necesarios: uno para mantener tu sesión iniciada y otro para recordar tu idioma. No usamos cookies de publicidad, analítica ni seguimiento. En las aplicaciones móviles, información equivalente se guarda en el almacenamiento seguro de la app.",
        },
      ],
    },
    {
      id: "how-long",
      title: "Cuánto tiempo conservamos la información",
      blocks: [
        {
          p: "Conservamos tu información mientras exista tu cuenta. Los pedidos se conservan hasta que se elimine tu cuenta o la del comerciante. Las copias de seguridad cifradas se conservan hasta 30 días, por lo que los datos eliminados pueden permanecer en ellas ese tiempo antes de caducar. Los proveedores de alojamiento conservan sus propios registros según sus políticas.",
        },
      ],
    },
    {
      id: "deleting-your-data",
      title: "Eliminar tu cuenta y tus datos",
      blocks: [
        { p: "Puedes eliminar tu cuenta tú mismo en cualquier momento: inicia sesión, abre Cuenta y elige \"Eliminar mi cuenta definitivamente\". Esto elimina:" },
        {
          ul: [
            "tu perfil y tu acceso,",
            "todos tus pedidos,",
            "si eres comerciante: tus comidas y sus fotos, puntos de recogida, ofertas y todos los pedidos de ellas (tus clientes pierden ese historial de pedidos).",
          ],
        },
        {
          p: "Un comerciante con pedidos próximos que los clientes aún esperan debe cancelarlos o completarlos antes. La eliminación no se puede deshacer. Si no puedes iniciar sesión o quieres una copia de tus datos, escribe a {contact}.",
        },
      ],
    },
    {
      id: "your-rights",
      title: "Tus derechos",
      blocks: [
        {
          p: "Según dónde vivas (por ejemplo en la UE, el Reino Unido o California) puedes tener derecho a acceder, corregir, eliminar o recibir una copia de tu información personal, y a oponerte a ciertos usos o limitarlos. Usa la eliminación dentro de la app o escribe a {contact}. También puedes presentar una queja ante tu autoridad local de protección de datos.",
        },
      ],
    },
    {
      id: "security",
      title: "Seguridad",
      blocks: [
        {
          p: "Los datos se protegen en tránsito con HTTPS, el acceso a los datos está restringido mediante reglas de base de datos para que cada persona vea solo lo que le corresponde, y las copias de seguridad están cifradas. Ningún sistema es perfectamente seguro, por lo que no podemos garantizar una seguridad absoluta.",
        },
      ],
    },
    {
      id: "international",
      title: "Transferencias internacionales",
      blocks: [
        { p: "Nuestros proveedores operan en varios países, incluidos los Estados Unidos, por lo que tu información puede tratarse fuera del país donde vives." },
      ],
    },
    {
      id: "children",
      title: "Menores",
      blocks: [
        { p: "El servicio no está dirigido a menores de 13 años (o a la edad mínima superior de tu país). Si crees que un menor tiene una cuenta, escribe a {contact} y la eliminaremos." },
      ],
    },
    {
      id: "payments",
      title: "Pagos",
      blocks: [
        { p: "El servicio no procesa pagos ni recopila datos de pago. Cualquier pago (por ejemplo efectivo, Venmo o Zelle) se acuerda directamente entre cliente y comerciante y está sujeto a las políticas de esos servicios." },
      ],
    },
    {
      id: "changes",
      title: "Cambios en esta política",
      blocks: [{ p: "Podemos actualizar esta política. La fecha al principio indica la versión más reciente y avisaremos en el servicio de los cambios importantes." }],
    },
    {
      id: "contact",
      title: "Contacto",
      blocks: [{ p: "Preguntas o solicitudes sobre esta política: {contact}." }],
    },
  ],
};


const zhCN: LegalDoc = {
  title: "隐私政策",
  intro:
    "Neighborhood Eats 让本地美食商家发布可自取的商品，也让顾客提前预订。本政策说明我们会处理哪些个人信息、为什么处理，以及您可以做出的选择。最后更新：{updated}。",
  sections: [
    {
      id: "who-we-are",
      title: "我们是谁",
      blocks: [
        { p: "{operator} 在 {site} 及其移动应用中运营 Neighborhood Eats（“本服务”）。如对本政策有疑问，请联系 {contact}。" },
      ],
    },
    {
      id: "information-we-collect",
      title: "我们收集的信息",
      blocks: [
        { p: "我们只收集运行本服务所需的信息：" },
        {
          ul: [
            "账户信息：当您使用 Google、Facebook、GitHub 或 Apple 登录时，该提供方会向我们提供您的姓名、电子邮件地址和头像链接。我们不会看到您的密码。我们还会保存一个唯一的账户 ID。",
            "偏好设置：您选择的语言。",
            "订单：您订购的商品和数量、订单状态、时间、对应的售卖场次和自取点，以及取餐时用于验证订单的二维码令牌。如果您为商家添加备注（例如关于过敏），备注会与订单一起保存，只有您和该商家能看到。",
            "商家信息（如果您注册为商家）：商家名称和简介、可选的标志、网站、联系邮箱和电话（显示给已登录的顾客）、国家、自取点（名称、地址和地图坐标）、菜品（含可选照片）、售卖场次（含可选的取餐说明），以及您撰写的翻译。我们会在保存照片前删除其中嵌入的位置信息。",
            "实时位置（仅限商家，可选）：见下文“实时位置”。",
            "技术信息：您的 IP 地址以及基本的设备和浏览器信息会出现在我们托管服务提供方的服务器日志中，我们将其用于安全保障和维持服务运行。",
          ],
        },
        { p: "我们不会索取或保存支付卡信息。作为顾客，我们不会收集您的精确位置。" },
      ],
    },
    {
      id: "location",
      title: "实时位置",
      blocks: [
        {
          p: "商家可以选择在自取当天共享实时位置，方便顾客查看其所在位置。此功能为可选项，默认关闭。开启期间，商家的设备会向我们发送其位置，我们只会向为该场次下过有效订单的顾客显示。我们只保存最新的位置（会被覆盖，不保留历史轨迹），商家关闭共享后即停止。只有在自取日期当天才能开启共享。",
        },
      ],
    },
    {
      id: "how-we-use-it",
      title: "我们如何使用信息",
      blocks: [
        {
          ul: [
            "提供服务：创建并保护您的账户，让商家发布售卖场次，让顾客在截止前下单、修改或取消，并通过二维码确认取餐。",
            "向商家显示向其下单的顾客的姓名和订单，并向顾客显示商家的经营信息和自取地点。",
            "以您的语言显示服务并保持您的登录状态。",
            "保护服务：防止滥用、解决问题并保存加密备份。",
          ],
        },
        { p: "我们不会出售您的个人信息，也不会将其用于广告或用户画像。" },
      ],
    },
    {
      id: "who-we-share-with",
      title: "谁会看到或接收您的信息",
      blocks: [
        {
          ul: [
            "商家和顾客：商家可看到向其下单者的姓名、头像和订单；顾客可看到商家的经营信息、菜品和自取点。",
            "Supabase：提供我们的数据库、登录和实时功能。",
            "Render：托管网站。",
            "登录提供方（Google、Facebook、GitHub、Apple）：您登录时，它们会根据各自的隐私政策告知我们您的身份。",
            "GitHub：托管我们的源代码并运行自动化任务，包括数据库的加密备份。",
            "Sentry：如果启用了错误监控，它会收到技术性的错误报告（出了什么问题以及发生在哪个页面或操作）。我们将其配置为不发送 Cookie、请求详情、您的账户信息或电子邮件地址。",
            "邮件服务商（Resend）：如果启用了邮件通知，它会收到您的电子邮件地址以及我们发送给您的邮件内容（订单确认、取餐提醒，以及商家的订单汇总）。您可以在“账户”中或通过每封邮件中的退订链接关闭这些邮件。",
            "OpenStreetMap：当您打开地图时，您的设备会向 OpenStreetMap 服务器请求地图图片，其可看到您的 IP 地址和您查看的区域。",
            "Open-Meteo 和 Nager.Date：我们的服务器会向它们查询自取地点和日期的天气与公共假日，不会发送任何个人信息。",
            "有关部门：法律要求时。",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookie 及类似技术",
      blocks: [
        {
          p: "我们只使用严格必要的 Cookie 和本地存储：一个用于保持登录状态（会话），一个用于记住您的语言。我们不使用广告、分析或跟踪类 Cookie。在移动应用中，类似的信息保存在应用的安全存储中。",
        },
      ],
    },
    {
      id: "how-long",
      title: "我们保存信息的时间",
      blocks: [
        {
          p: "只要您的账户存在，我们就会保存您的信息。订单会保存到您或商家的账户被删除为止。加密备份最多保存 30 天，因此已删除的数据在过期之前可能仍会在备份中保留这段时间。托管服务提供方会按其自身政策保存其日志。",
        },
      ],
    },
    {
      id: "deleting-your-data",
      title: "删除您的账户和数据",
      blocks: [
        { p: "您可以随时自行删除账户：登录后打开“账户”，选择“永久删除我的账户”。这将删除：" },
        {
          ul: [
            "您的个人资料和登录信息，",
            "您的所有订单，",
            "如果您是商家：您的菜品及其照片、自取点、售卖场次及其下的所有订单（您的顾客将失去这些订单记录）。",
          ],
        },
        {
          p: "如果商家有顾客仍在等待的未完成订单，必须先取消或完成这些订单。删除后无法恢复。如果您无法登录，或希望获取您的数据副本，请联系 {contact}。",
        },
      ],
    },
    {
      id: "your-rights",
      title: "您的权利",
      blocks: [
        {
          p: "根据您所在的地区（例如欧盟、英国或加利福尼亚州），您可能有权访问、更正、删除或获取您的个人信息副本，并反对或限制某些用途。请使用上述应用内删除功能，或联系 {contact}。您也可以向当地的数据保护机构投诉。",
        },
      ],
    },
    {
      id: "security",
      title: "安全",
      blocks: [
        {
          p: "数据在传输中通过 HTTPS 保护，数据库规则限制访问，使每个人只能看到其应看到的内容，备份经过加密。没有任何系统是绝对安全的，因此我们无法保证绝对的安全。",
        },
      ],
    },
    {
      id: "international",
      title: "跨境传输",
      blocks: [
        { p: "我们的服务提供方在多个国家（包括美国）运营，因此您的信息可能会在您所在国家以外被处理。" },
      ],
    },
    {
      id: "children",
      title: "儿童",
      blocks: [
        { p: "本服务不面向 13 岁以下的儿童（或您所在国家规定的更高最低年龄）。如果您认为有儿童拥有账户，请联系 {contact}，我们会将其删除。" },
      ],
    },
    {
      id: "payments",
      title: "付款",
      blocks: [
        { p: "本服务不处理付款，也不收集付款信息。任何付款（例如现金、Venmo 或 Zelle）均由顾客与商家直接安排，并受这些服务各自政策的约束。" },
      ],
    },
    {
      id: "changes",
      title: "本政策的变更",
      blocks: [{ p: "我们可能会更新本政策。顶部的日期表示最新版本，重大变更我们会在服务中通知。" }],
    },
    {
      id: "contact",
      title: "联系我们",
      blocks: [{ p: "对本政策的疑问或请求：{contact}。" }],
    },
  ],
};

const zhTW: LegalDoc = {
  title: "隱私權政策",
  intro:
    "Neighborhood Eats 讓在地美食商家刊登可自取的商品，也讓顧客提前預訂。本政策說明我們會處理哪些個人資料、為什麼處理，以及您可以做出的選擇。最後更新：{updated}。",
  sections: [
    {
      id: "who-we-are",
      title: "我們是誰",
      blocks: [
        { p: "{operator} 在 {site} 及其行動應用程式中營運 Neighborhood Eats（「本服務」）。如對本政策有疑問，請聯絡 {contact}。" },
      ],
    },
    {
      id: "information-we-collect",
      title: "我們蒐集的資料",
      blocks: [
        { p: "我們只蒐集營運本服務所需的資料：" },
        {
          ul: [
            "帳戶資料：當您使用 Google、Facebook、GitHub 或 Apple 登入時，該提供者會向我們提供您的姓名、電子郵件地址和大頭貼連結。我們不會看到您的密碼。我們也會保存一個唯一的帳戶 ID。",
            "偏好設定：您選擇的語言。",
            "訂單：您訂購的品項和數量、訂單狀態、時間、對應的販售場次和自取點，以及取餐時用於驗證訂單的 QR 碼權杖。若您為商家加上備註（例如關於過敏），備註會與訂單一起儲存，只有您和該商家看得到。",
            "商家資料（若您註冊為商家）：商家名稱與簡介、選填的標誌、網站、聯絡電子郵件和電話（顯示給已登入的顧客）、國家、自取點（名稱、地址和地圖座標）、餐點（含選填照片）、販售場次（含選填的取餐說明），以及您撰寫的翻譯。我們會在儲存照片前刪除其中嵌入的位置資訊。",
            "即時位置（僅限商家，選填）：請見下方「即時位置」。",
            "技術資料：您的 IP 位址以及基本的裝置和瀏覽器資訊會出現在我們代管服務提供者的伺服器記錄中，我們將其用於安全防護和維持服務運作。",
          ],
        },
        { p: "我們不會索取或儲存付款卡資料。身為顧客，我們不會蒐集您的精確位置。" },
      ],
    },
    {
      id: "location",
      title: "即時位置",
      blocks: [
        {
          p: "商家可以選擇在自取當天分享即時位置，方便顧客查看其所在位置。此功能為選用，預設關閉。開啟期間，商家的裝置會向我們傳送其位置，我們只會向為該場次下過有效訂單的顧客顯示。我們只保存最新的位置（會被覆蓋，不保留歷史軌跡），商家關閉分享後即停止。只有在自取日期當天才能開啟分享。",
        },
      ],
    },
    {
      id: "how-we-use-it",
      title: "我們如何使用資料",
      blocks: [
        {
          ul: [
            "提供服務：建立並保護您的帳戶，讓商家刊登販售場次，讓顧客在截止前下單、修改或取消，並透過 QR 碼確認取餐。",
            "向商家顯示向其下單的顧客的姓名和訂單，並向顧客顯示商家的營業資訊和自取地點。",
            "以您的語言顯示服務並保持您的登入狀態。",
            "保護服務：防止濫用、解決問題並保存加密備份。",
          ],
        },
        { p: "我們不會出售您的個人資料，也不會將其用於廣告或使用者剖析。" },
      ],
    },
    {
      id: "who-we-share-with",
      title: "誰會看到或接收您的資料",
      blocks: [
        {
          ul: [
            "商家和顧客：商家可看到向其下單者的姓名、大頭貼和訂單；顧客可看到商家的營業資訊、餐點和自取點。",
            "Supabase：提供我們的資料庫、登入和即時功能。",
            "Render：代管網站。",
            "登入提供者（Google、Facebook、GitHub、Apple）：您登入時，它們會依各自的隱私權政策告知我們您的身分。",
            "GitHub：代管我們的原始碼並執行自動化工作，包括資料庫的加密備份。",
            "Sentry：若啟用了錯誤監控，它會收到技術性的錯誤報告（出了什麼問題以及發生在哪個頁面或操作）。我們將其設定為不傳送 Cookie、請求詳情、您的帳戶資訊或電子郵件地址。",
            "郵件服務商（Resend）：若啟用了電子郵件通知，它會收到您的電子郵件地址以及我們寄給您的郵件內容（訂單確認、取餐提醒，以及商家的訂單彙總）。您可以在「帳戶」中或透過每封郵件中的取消訂閱連結關閉這些郵件。",
            "OpenStreetMap：當您開啟地圖時，您的裝置會向 OpenStreetMap 伺服器請求地圖圖片，其可看到您的 IP 位址和您查看的區域。",
            "Open-Meteo 和 Nager.Date：我們的伺服器會向它們查詢自取地點和日期的天氣與國定假日，不會傳送任何個人資料。",
            "主管機關：法律要求時。",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookie 及類似技術",
      blocks: [
        {
          p: "我們只使用嚴格必要的 Cookie 和本機儲存：一個用於保持登入狀態（工作階段），一個用於記住您的語言。我們不使用廣告、分析或追蹤類 Cookie。在行動應用程式中，類似的資訊保存在應用程式的安全儲存空間中。",
        },
      ],
    },
    {
      id: "how-long",
      title: "我們保存資料的時間",
      blocks: [
        {
          p: "只要您的帳戶存在，我們就會保存您的資料。訂單會保存到您或商家的帳戶被刪除為止。加密備份最多保存 30 天，因此已刪除的資料在到期之前可能仍會在備份中保留這段時間。代管服務提供者會依其自身政策保存其記錄。",
        },
      ],
    },
    {
      id: "deleting-your-data",
      title: "刪除您的帳戶和資料",
      blocks: [
        { p: "您可以隨時自行刪除帳戶：登入後開啟「帳戶」，選擇「永久刪除我的帳戶」。這將刪除：" },
        {
          ul: [
            "您的個人資料和登入資訊，",
            "您的所有訂單，",
            "若您是商家：您的餐點及其照片、自取點、販售場次及其下的所有訂單（您的顧客將失去這些訂單紀錄）。",
          ],
        },
        {
          p: "若商家有顧客仍在等待的未完成訂單，必須先取消或完成這些訂單。刪除後無法復原。如果您無法登入，或希望取得您的資料副本，請聯絡 {contact}。",
        },
      ],
    },
    {
      id: "your-rights",
      title: "您的權利",
      blocks: [
        {
          p: "依您所在的地區（例如歐盟、英國或加州），您可能有權存取、更正、刪除或取得您的個人資料副本，並反對或限制某些用途。請使用上述應用程式內的刪除功能，或聯絡 {contact}。您也可以向當地的資料保護主管機關申訴。",
        },
      ],
    },
    {
      id: "security",
      title: "安全",
      blocks: [
        {
          p: "資料在傳輸中透過 HTTPS 保護，資料庫規則限制存取，使每個人只能看到其應看到的內容，備份經過加密。沒有任何系統是絕對安全的，因此我們無法保證絕對的安全。",
        },
      ],
    },
    {
      id: "international",
      title: "跨境傳輸",
      blocks: [
        { p: "我們的服務提供者在多個國家（包括美國）營運，因此您的資料可能會在您所在國家以外被處理。" },
      ],
    },
    {
      id: "children",
      title: "兒童",
      blocks: [
        { p: "本服務不以 13 歲以下的兒童（或您所在國家規定的更高最低年齡）為對象。如果您認為有兒童擁有帳戶，請聯絡 {contact}，我們會將其刪除。" },
      ],
    },
    {
      id: "payments",
      title: "付款",
      blocks: [
        { p: "本服務不處理付款，也不蒐集付款資料。任何付款（例如現金、Venmo 或 Zelle）均由顧客與商家直接安排，並受這些服務各自政策的約束。" },
      ],
    },
    {
      id: "changes",
      title: "本政策的變更",
      blocks: [{ p: "我們可能會更新本政策。頂部的日期表示最新版本，重大變更我們會在服務中通知。" }],
    },
    {
      id: "contact",
      title: "聯絡我們",
      blocks: [{ p: "對本政策的疑問或請求：{contact}。" }],
    },
  ],
};

export const privacy: Record<Locale, LegalDoc> = { en, es, "zh-CN": zhCN, "zh-TW": zhTW };
