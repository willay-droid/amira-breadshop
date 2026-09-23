import "../styles/globals.css";
import { ThemeProvider } from "next-themes";
import { ProductProvider } from "../context/ProductContext";
import { AuthProvider } from "../context/AuthContext"; // Import Auth
import Sidebar from "../components/Sidebar";

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class">
      <AuthProvider>
        <ProductProvider>
          <div className="flex min-h-screen bg-[#FDFBF7] dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 transition-colors duration-300 w-full overflow-hidden">
            <Sidebar />
            <div className="flex-1 w-full overflow-y-auto">
              <Component {...pageProps} />
            </div>
          </div>
        </ProductProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
