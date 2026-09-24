import { useState, useContext } from "react";
import Head from "next/head";
import { AuthContext } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function LoginPage() {
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await login(username, password);
      if (!success) {
        setError("Username atau password salah!");
      }
    } catch (err) {
      setError("Terjadi kesalahan pada sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300 px-4 relative">
      <Head>
        <title>Login - Toko Roti Amira</title>
        {/* Mengimpor Google Font bergaya tulisan sambung/latin (Great Vibes) untuk logo Amira */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Tombol Toggle Tema di Pojok Kanan Atas */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Container Card Login */}
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-3xl shadow-xl border border-gray-100 dark:border-zinc-700 p-8 sm:p-10 transition-all duration-300 flex flex-col items-center">
        {/* LOGO AMIRA BAKERY & CAKE */}
        <div className="text-center flex flex-col items-center">
          {/* Tambahan drop-shadow-md (terang) dan drop-shadow custom glowing (gelap) */}
          <h1
            className="text-6xl sm:text-7xl font-normal text-amber-500 dark:text-amber-400 tracking-wide transition-colors duration-300 drop-shadow-md dark:drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)]"
            style={{ fontFamily: "'Great Vibes', cursive", lineHeight: "0.8" }}
          >
            Amira
          </h1>

          {/* Tambahan drop-shadow-sm biar teks bawahnya juga sedikit timbul */}
          <span className="text-sm sm:text-base font-semibold tracking-[0.25em] text-gray-400 dark:text-zinc-300 uppercase mt-1 drop-shadow-sm">
            Bakery & Cake
          </span>
        </div>

        {/* Jarak atas dan bawah tetap dipertahankan biar mepet */}
        <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 text-center mt-6 mb-4">
          Silakan masuk ke akun Anda
        </p>

        {/* Pesan Error */}
        {error && (
          <div className="w-full mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl text-center animate-shake">
            {error}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-500 text-gray-800 dark:text-gray-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-amber-500 text-gray-800 dark:text-gray-100 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        {/* Footer Kecil */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-gray-400 dark:text-zinc-500">
            Sistem Informasi POS & Keuangan &copy; 2026 Toko Roti Amira
          </p>
        </div>
      </div>
    </div>
  );
}
