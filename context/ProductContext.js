import { createContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // Import koneksi database

export const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fungsi untuk mengambil data produk dari Supabase
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("produk")
        .select("*")
        .order("id", { ascending: true }); // Urutkan berdasarkan ID

      if (error) {
        console.error("Gagal mengambil data produk:", error);
      } else if (data) {
        // Mapping nama kolom database (nama, harga_jual) agar cocok dengan variabel UI lama (name, price)
        // Di dalam fungsi fetchProducts, cari bagian yang nge-map data dari Supabase:
        const formattedData = data.map((item) => ({
          id: item.id,
          name: item.nama,
          price: item.harga_jual,
          stock: item.stok,
          modalBahan: item.modal_bahan,
          biayaKemasan: item.biaya_kemasan,
          foto: item.foto,

          // 👇 TAMBAHKAN 3 BARIS INI BRO 👇
          kategori_id: item.kategori_id,
          jenis: item.jenis,
          hargaAwal: item.harga_awal,
        }));

        setProducts(formattedData);
      }
    } catch (err) {
      console.error("Terjadi kesalahan:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Otomatis tarik data saat aplikasi pertama kali dimuat
  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <ProductContext.Provider
      value={{ products, setProducts, fetchProducts, isLoading }}
    >
      {children}
    </ProductContext.Provider>
  );
}
