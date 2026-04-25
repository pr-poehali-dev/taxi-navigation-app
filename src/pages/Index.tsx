import { useState } from "react";
import Icon from "@/components/ui/icon";

type Section = "home" | "order" | "tracking" | "tariffs" | "payments" | "history" | "chat" | "profile";

const TRIP_HISTORY = [
  { id: 1, from: "ул. Ленина, 12", to: "Аэропорт Домодедово", date: "23 апр, 14:20", price: "1 240 ₽", distance: "42 км", class: "Комфорт", rating: 5, driver: "Алексей К." },
  { id: 2, from: "Красная площадь", to: "ул. Садовая, 7", date: "21 апр, 09:05", price: "380 ₽", distance: "8 км", class: "Эконом", rating: 4, driver: "Михаил Р." },
  { id: 3, from: "ТЦ Мега", to: "Проспект Мира, 44", date: "19 апр, 18:45", price: "620 ₽", distance: "14 км", class: "Бизнес", rating: 5, driver: "Дмитрий В." },
  { id: 4, from: "Парк Горького", to: "Хамовники, 3", date: "17 апр, 11:30", price: "290 ₽", distance: "6 км", class: "Эконом", rating: 3, driver: "Сергей Н." },
];

const CHAT_MESSAGES = [
  { id: 1, from: "driver", text: "Добрый день! Я уже еду к вам, буду через 3 минуты.", time: "14:22" },
  { id: 2, from: "user", text: "Хорошо, жду у центрального входа.", time: "14:23" },
  { id: 3, from: "driver", text: "Понял, вижу вас! Серебристая Toyota Camry.", time: "14:26" },
  { id: 4, from: "dispatcher", text: "Водитель прибыл. Приятной поездки!", time: "14:27" },
];

const TARIFFS = [
  { name: "Эконом", icon: "Car", base: 89, perKm: 18, minTime: 2, color: "text-emerald-400", desc: "Бюджетные авто" },
  { name: "Комфорт", icon: "Car", base: 149, perKm: 28, minTime: 3, color: "text-taxi", desc: "Комфортные седаны" },
  { name: "Бизнес", icon: "Car", base: 249, perKm: 45, minTime: 5, color: "text-violet-400", desc: "Премиум авто" },
  { name: "Минивэн", icon: "Truck", base: 199, perKm: 35, minTime: 5, color: "text-blue-400", desc: "До 6 пассажиров" },
];

export default function Index() {
  const [section, setSection] = useState<Section>("home");
  const [selectedClass, setSelectedClass] = useState(1);
  const [fromAddr, setFromAddr] = useState("");
  const [toAddr, setToAddr] = useState("");
  const [distance, setDistance] = useState(12);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState(CHAT_MESSAGES);
  const [rideActive, setRideActive] = useState(false);
  const [activePayment, setActivePayment] = useState(0);

  const calcPrice = (idx: number, dist: number) => {
    const t = TARIFFS[idx];
    return Math.round(t.base + t.perKm * dist);
  };

  const sendMessage = () => {
    if (!chatMsg.trim()) return;
    setMessages(prev => [...prev, { id: prev.length + 1, from: "user", text: chatMsg, time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) }]);
    setChatMsg("");
  };

  const navItems: { id: Section; icon: string; label: string }[] = [
    { id: "home", icon: "Home", label: "Главная" },
    { id: "order", icon: "MapPin", label: "Заказ" },
    { id: "tracking", icon: "Navigation", label: "Карта" },
    { id: "tariffs", icon: "Tag", label: "Тарифы" },
    { id: "payments", icon: "CreditCard", label: "Платежи" },
    { id: "history", icon: "Clock", label: "История" },
    { id: "chat", icon: "MessageCircle", label: "Чат" },
    { id: "profile", icon: "User", label: "Профиль" },
  ];

  return (
    <div className="app-root">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <span className="logo-dot" />
          <span className="logo-text">TaxiGo</span>
        </div>
        <div className="header-status">
          {rideActive && (
            <div className="ride-badge">
              <span className="ride-dot" />
              Поездка активна
            </div>
          )}
          <button className="header-avatar" onClick={() => setSection("profile")}>
            АК
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* HOME */}
        {section === "home" && (
          <div className="section-enter">
            <div className="map-bg">
              <div className="map-grid" />
              <div className="map-pulse-ring" />
              <div className="map-car-dot">
                <Icon name="Car" size={20} />
              </div>
              <div className="map-label" style={{ top: "1rem", left: "1rem" }}>ул. Ленина, 12</div>
              <div className="map-label" style={{ bottom: "1rem", right: "1rem" }}>Аэропорт</div>
              <div className="map-route-line" />
            </div>

            <div className="home-overlay">
              <div className="home-greeting">
                <p className="greeting-time">Добрый день</p>
                <h1 className="greeting-name">Андрей Климов</h1>
                <p className="greeting-sub">Куда едем сегодня?</p>
              </div>

              <div className="quick-input" onClick={() => setSection("order")}>
                <Icon name="MapPin" size={16} className="text-taxi" />
                <span>Введите адрес назначения…</span>
                <Icon name="ChevronRight" size={16} className="text-white/30" />
              </div>

              <div className="quick-classes">
                {TARIFFS.map((t, i) => (
                  <button key={i} className={`quick-class-btn ${selectedClass === i ? "active" : ""}`} onClick={() => setSelectedClass(i)}>
                    <Icon name={t.icon} size={18} />
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>

              <button className="cta-button" onClick={() => setSection("order")}>
                <Icon name="Zap" size={18} />
                Вызвать такси
              </button>
            </div>
          </div>
        )}

        {/* ORDER */}
        {section === "order" && (
          <div className="section-enter p-5 space-y-5">
            <h2 className="section-title">Новый заказ</h2>

            <div className="route-card">
              <div className="route-input-wrap">
                <div className="route-dot route-dot-from" />
                <input
                  className="route-input"
                  placeholder="Откуда"
                  value={fromAddr}
                  onChange={e => setFromAddr(e.target.value)}
                />
              </div>
              <div className="route-divider" />
              <div className="route-input-wrap">
                <div className="route-dot route-dot-to" />
                <input
                  className="route-input"
                  placeholder="Куда"
                  value={toAddr}
                  onChange={e => setToAddr(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="label-sm">Расстояние</p>
                <p className="label-val">{distance} км</p>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={distance}
                onChange={e => setDistance(+e.target.value)}
                className="range-slider"
              />
            </div>

            <div>
              <p className="label-sm mb-3">Класс автомобиля</p>
              <div className="class-grid">
                {TARIFFS.map((t, i) => (
                  <button key={i} className={`class-card ${selectedClass === i ? "selected" : ""}`} onClick={() => setSelectedClass(i)}>
                    <Icon name={t.icon} size={22} className={t.color} />
                    <span className="class-name">{t.name}</span>
                    <span className="class-desc">{t.desc}</span>
                    <span className="class-price">{calcPrice(i, distance)} ₽</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="order-summary">
              <div className="summary-row">
                <span>Итого</span>
                <span className="summary-price">{calcPrice(selectedClass, distance)} ₽</span>
              </div>
              <div className="summary-row text-white/40 text-sm">
                <span>{TARIFFS[selectedClass].name} · {distance} км</span>
                <span>~{Math.ceil(distance / 40 * 60)} мин</span>
              </div>
            </div>

            <button className="cta-button" onClick={() => { setRideActive(true); setSection("tracking"); }}>
              <Icon name="Navigation" size={18} />
              Заказать поездку
            </button>
          </div>
        )}

        {/* TRACKING */}
        {section === "tracking" && (
          <div className="section-enter">
            <div className="tracking-map">
              <div className="map-grid" />
              <div className="tracking-car">
                <Icon name="Car" size={28} className="text-taxi" />
              </div>
              <div className="tracking-dot" style={{ top: "30%", left: "25%" }} />
              <div className="tracking-dot" style={{ top: "55%", left: "60%" }} />
              <div className="tracking-dot active" style={{ top: "70%", left: "75%" }} />
              <div className="tracking-route-line" />
            </div>

            <div className="tracking-panel">
              {rideActive ? (
                <>
                  <div className="tracking-info">
                    <div>
                      <p className="tracking-label">Водитель</p>
                      <p className="tracking-value">Алексей Кириллов</p>
                    </div>
                    <div className="driver-stars">
                      {"★★★★★".split("").map((s, i) => <span key={i} className="text-taxi">{s}</span>)}
                    </div>
                  </div>
                  <div className="tracking-info">
                    <div>
                      <p className="tracking-label">Авто</p>
                      <p className="tracking-value">Toyota Camry · А123ВС</p>
                    </div>
                    <div className="tracking-eta">
                      <span className="eta-num">4</span>
                      <span className="eta-unit">мин</span>
                    </div>
                  </div>
                  <button className="cta-button-outline" onClick={() => setSection("chat")}>
                    <Icon name="MessageCircle" size={16} />
                    Написать водителю
                  </button>
                  <button className="cta-button danger" onClick={() => setRideActive(false)}>
                    Завершить поездку
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-white/50 mb-4">Нет активных поездок</p>
                  <button className="cta-button" onClick={() => setSection("order")}>
                    Заказать такси
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TARIFFS */}
        {section === "tariffs" && (
          <div className="section-enter p-5 space-y-4">
            <h2 className="section-title">Тарифы</h2>

            <div className="flex items-center justify-between mb-2">
              <p className="label-sm">Расстояние для расчёта</p>
              <span className="label-val">{distance} км</span>
            </div>
            <input type="range" min={1} max={100} value={distance} onChange={e => setDistance(+e.target.value)} className="range-slider mb-2" />

            <div className="space-y-3">
              {TARIFFS.map((t, i) => (
                <div key={i} className={`tariff-card ${selectedClass === i ? "selected" : ""}`} onClick={() => setSelectedClass(i)}>
                  <div className="tariff-left">
                    <div className={`tariff-icon-wrap ${t.color}`}>
                      <Icon name={t.icon} size={22} />
                    </div>
                    <div>
                      <p className="tariff-name">{t.name}</p>
                      <p className="tariff-desc">{t.desc}</p>
                    </div>
                  </div>
                  <div className="tariff-right">
                    <p className="tariff-price">{calcPrice(i, distance)} ₽</p>
                    <p className="tariff-per">от {t.base}₽ + {t.perKm}₽/км</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="info-block">
              <Icon name="Info" size={14} className="text-taxi mt-0.5 shrink-0" />
              <p>Итоговая стоимость зависит от трафика и времени суток. Ночной коэффициент: ×1.3</p>
            </div>
          </div>
        )}

        {/* PAYMENTS */}
        {section === "payments" && (
          <div className="section-enter p-5 space-y-5">
            <h2 className="section-title">Платежи</h2>

            <div className="space-y-3">
              <p className="label-sm">Способы оплаты</p>
              {[
                { icon: "CreditCard", name: "Visa •••• 4821", sub: "Основная карта", color: "text-blue-400" },
                { icon: "Smartphone", name: "SberPay", sub: "Сбербанк", color: "text-emerald-400" },
                { icon: "Wallet", name: "Кошелёк TaxiGo", sub: "Баланс: 1 200 ₽", color: "text-taxi" },
              ].map((p, i) => (
                <div key={i} className={`payment-card ${activePayment === i ? "selected" : ""}`} onClick={() => setActivePayment(i)}>
                  <Icon name={p.icon} size={22} className={p.color} />
                  <div className="flex-1">
                    <p className="payment-name">{p.name}</p>
                    <p className="payment-sub">{p.sub}</p>
                  </div>
                  {activePayment === i && <Icon name="CheckCircle2" size={18} className="text-taxi" />}
                </div>
              ))}
              <button className="add-card-btn">
                <Icon name="Plus" size={16} />
                Добавить карту
              </button>
            </div>

            <div>
              <p className="label-sm mb-3">Последние транзакции</p>
              <div className="space-y-2">
                {TRIP_HISTORY.slice(0, 3).map(t => (
                  <div key={t.id} className="tx-row">
                    <div>
                      <p className="tx-to">{t.to}</p>
                      <p className="tx-date">{t.date}</p>
                    </div>
                    <span className="tx-price">−{t.price}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="balance-card">
              <p className="balance-label">Общий баланс</p>
              <p className="balance-amount">1 200 ₽</p>
              <button className="topup-btn">Пополнить</button>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {section === "history" && (
          <div className="section-enter p-5 space-y-4">
            <h2 className="section-title">История поездок</h2>
            <div className="space-y-3">
              {TRIP_HISTORY.map(trip => (
                <div key={trip.id} className="history-card">
                  <div className="history-header">
                    <span className={`history-class ${trip.class === "Бизнес" ? "text-violet-400" : trip.class === "Комфорт" ? "text-taxi" : "text-emerald-400"}`}>
                      {trip.class}
                    </span>
                    <span className="history-date">{trip.date}</span>
                  </div>
                  <div className="history-route">
                    <div className="history-route-item">
                      <span className="route-from-dot" />
                      <span>{trip.from}</span>
                    </div>
                    <div className="history-route-item">
                      <span className="route-to-dot" />
                      <span>{trip.to}</span>
                    </div>
                  </div>
                  <div className="history-footer">
                    <div className="history-stars">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={i < trip.rating ? "text-taxi" : "text-white/20"}>★</span>
                      ))}
                      <span className="text-white/40 text-xs ml-1">{trip.driver}</span>
                    </div>
                    <div className="history-meta">
                      <span className="text-white/40 text-xs">{trip.distance}</span>
                      <span className="history-price">{trip.price}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT */}
        {section === "chat" && (
          <div className="section-enter chat-wrap">
            <div className="chat-header-bar">
              <div className="chat-driver-info">
                <div className="chat-avatar">АК</div>
                <div>
                  <p className="chat-driver-name">Алексей Кириллов</p>
                  <p className="chat-driver-status">
                    <span className="online-dot" />
                    В пути · Toyota Camry
                  </p>
                </div>
              </div>
              <button className="chat-call-btn">
                <Icon name="Phone" size={18} />
              </button>
            </div>

            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`chat-bubble-wrap ${msg.from === "user" ? "user" : ""}`}>
                  {msg.from !== "user" && (
                    <div className={`chat-sender-label ${msg.from === "dispatcher" ? "text-violet-400" : "text-taxi"}`}>
                      {msg.from === "driver" ? "Водитель" : "Диспетчер"}
                    </div>
                  )}
                  <div className={`chat-bubble ${msg.from === "user" ? "bubble-user" : msg.from === "dispatcher" ? "bubble-dispatcher" : "bubble-driver"}`}>
                    {msg.text}
                  </div>
                  <span className="chat-time">{msg.time}</span>
                </div>
              ))}
            </div>

            <div className="chat-input-bar">
              <input
                className="chat-input"
                placeholder="Написать сообщение…"
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
              />
              <button className="chat-send-btn" onClick={sendMessage}>
                <Icon name="Send" size={18} />
              </button>
            </div>
          </div>
        )}

        {/* PROFILE */}
        {section === "profile" && (
          <div className="section-enter p-5 space-y-5">
            <div className="profile-hero">
              <div className="profile-avatar">АК</div>
              <div>
                <h2 className="profile-name">Андрей Климов</h2>
                <p className="profile-phone">+7 (985) 123-45-67</p>
                <div className="profile-rating">
                  <Icon name="Star" size={14} className="text-taxi" />
                  <span>4.9 · 47 поездок</span>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <p className="label-sm mb-2">Настройки</p>
              {[
                { icon: "Bell", label: "Уведомления" },
                { icon: "MapPin", label: "Адреса" },
                { icon: "Shield", label: "Безопасность" },
                { icon: "Globe", label: "Язык: Русский" },
                { icon: "HelpCircle", label: "Поддержка" },
              ].map((item, i) => (
                <button key={i} className="settings-row">
                  <Icon name={item.icon} size={18} className="text-white/50" />
                  <span>{item.label}</span>
                  <Icon name="ChevronRight" size={16} className="text-white/30 ml-auto" />
                </button>
              ))}
            </div>

            <div className="settings-group">
              <p className="label-sm mb-2">Оценки и отзывы</p>
              <div className="review-stats">
                <div className="review-stat-item">
                  <span className="review-stat-num">47</span>
                  <span className="review-stat-label">Поездок</span>
                </div>
                <div className="review-stat-item">
                  <span className="review-stat-num text-taxi">4.9</span>
                  <span className="review-stat-label">Рейтинг</span>
                </div>
                <div className="review-stat-item">
                  <span className="review-stat-num text-violet-400">12</span>
                  <span className="review-stat-label">Отзывов</span>
                </div>
              </div>
            </div>

            <button className="logout-btn">
              <Icon name="LogOut" size={16} />
              Выйти из аккаунта
            </button>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${section === item.id ? "active" : ""}`}
            onClick={() => setSection(item.id)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}