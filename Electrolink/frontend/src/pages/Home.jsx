import { Link } from "react-router-dom";

function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-linear-to-br from-slate-950 via-blue-950 to-slate-900">
        <div className="mx-auto grid min-h-155 max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
          
          {/* Left Content */}
          <div>
            <p className="mb-5 inline-block rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-300">
              India's B2B Electronics Marketplace
            </p>

            <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl">
              Source Electronic
              <span className="block text-blue-400">
                Components Faster
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              ElectroLink connects manufacturers, engineers, R&D teams, and
              industrial buyers with reliable electronic components from
              trusted suppliers.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                to="/products"
                className="rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white transition hover:bg-blue-500"
              >
                Browse Products
              </Link>

              <Link
                to="/register"
                className="rounded-xl border border-slate-500 px-7 py-3.5 font-semibold text-white transition hover:border-white hover:bg-white/10"
              >
                Create Business Account
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap gap-8 text-slate-300">
              <div>
                <p className="text-2xl font-bold text-white">500+</p>
                <p className="text-sm">Components</p>
              </div>

              <div>
                <p className="text-2xl font-bold text-white">100+</p>
                <p className="text-sm">Business Buyers</p>
              </div>

              <div>
                <p className="text-2xl font-bold text-white">24/7</p>
                <p className="text-sm">Support</p>
              </div>
            </div>
          </div>

          {/* Right Card */}
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
                Featured Component
              </p>

              <div className="mt-8 rounded-2xl bg-slate-900 p-8">
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-blue-600 text-5xl">
                  ⚡
                </div>

                <h2 className="mt-7 text-3xl font-bold text-white">
                  ESP32 Development Board
                </h2>

                <p className="mt-3 text-slate-400">
                  Wi-Fi and Bluetooth-enabled microcontroller for IoT and
                  industrial automation projects.
                </p>

                <div className="mt-7 flex items-center justify-between">
                  <span className="text-2xl font-bold text-blue-400">
                    ₹599
                  </span>

                  <span className="rounded-full bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-300">
                    In Stock
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Categories */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="font-semibold text-blue-700">
              PRODUCT CATEGORIES
            </p>

            <h2 className="mt-3 text-4xl font-bold text-slate-900">
              Everything Your Project Needs
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              Find reliable electronic components for prototypes,
              manufacturing, automation, and industrial applications.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            <div className="rounded-2xl bg-white p-7 shadow-sm">
              <div className="text-4xl">🔌</div>
              <h3 className="mt-5 text-xl font-bold">
                Connectors
              </h3>
              <p className="mt-2 text-slate-600">
                Reliable connectors and terminals.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-7 shadow-sm">
              <div className="text-4xl">⚙️</div>
              <h3 className="mt-5 text-xl font-bold">
                Microcontrollers
              </h3>
              <p className="mt-2 text-slate-600">
                Development boards and controllers.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-7 shadow-sm">
              <div className="text-4xl">📡</div>
              <h3 className="mt-5 text-xl font-bold">
                Sensors
              </h3>
              <p className="mt-2 text-slate-600">
                Sensors for industrial applications.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-7 shadow-sm">
              <div className="text-4xl">💾</div>
              <h3 className="mt-5 text-xl font-bold">
                Semiconductors
              </h3>
              <p className="mt-2 text-slate-600">
                Components for electronic systems.
              </p>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;