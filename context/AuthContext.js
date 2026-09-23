import { createContext, useState, useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabase";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const router = useRouter();

  // 1. Cek sesi saat aplikasi dimuat
  useEffect(() => {
    const savedSession = localStorage.getItem("amira_session");
    if (savedSession) {
      setUser(JSON.parse(savedSession));
    } else if (router.pathname !== "/login") {
      router.replace("/login"); // Gunakan replace agar tidak masuk history browser
    }
    setIsAuthReady(true);
  }, []);

  // 2. Pantau terus perubahan URL
  useEffect(() => {
    if (isAuthReady) {
      const savedSession = localStorage.getItem("amira_session");
      if (!savedSession && router.pathname !== "/login") {
        router.replace("/login");
      }
    }
  }, [router.pathname, isAuthReady]);

  const login = async (username, password) => {
    try {
      const { data, error } = await supabase
        .from("pengguna")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single();

      if (error || !data) {
        return { success: false, message: "Username atau password salah!" };
      }

      const userData = { id: data.id, role: data.role, name: data.nama };
      setUser(userData);
      localStorage.setItem("amira_session", JSON.stringify(userData));

      if (data.role === "admin") {
        router.push("/dashboard");
      } else {
        router.push("/");
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: "Terjadi kesalahan koneksi ke server.",
      };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("amira_session");
    router.replace("/login"); // Langsung tendang tanpa simpan history
  };

  // 3. GEMBOK MUTLAK: Jangan render apapun jika bukan di /login dan user kosong
  const isProtectedRoute = router.pathname !== "/login";

  if (!isAuthReady || (isProtectedRoute && !user)) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-zinc-900 flex items-center justify-center">
        {/* Layar kosong ini akan menahan kebocoran UI saat proses tendang ke /login berlangsung */}
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
