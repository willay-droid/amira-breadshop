import { useState, useContext } from "react";
import Head from "next/head";
import ThemeToggle from "../components/ThemeToggle";
import { AuthContext } from "../context/AuthContext";
import { ProductContext } from "../context/ProductContext";
import { supabase } from "../lib/supabase";

export default function KasirPage() {
  const { logout, user } = useContext(AuthContext);
  const { products, fetchProducts, isLoading } = useContext(ProductContext);

  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // State untuk Search, Pre-Order, & Popup Pembayaran
  const [searchProduct, setSearchProduct] = useState("");
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()),
  );

  const addToCart = (product) => {
    if (!isPreOrder && product.stock <= 0) {
      alert(
        "Stok harian habis! Gunakan mode Pre-Order jika ini pesanan khusus.",
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const newQty = existing.qty + 1;
        if (!isPreOrder && newQty > product.stock) {
          alert("Maksimal stok harian tercapai!");
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: newQty } : item,
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQty = item.qty + delta;
          if (newQty > 0 && (isPreOrder || newQty <= item.stock))
            return { ...item, qty: newQty };
        }
        return item;
      }),
    );
  };

  const handleDirectQtyChange = (productId, value) => {
    const val = parseInt(value, 10);
    const product = products.find((p) => p.id === productId);

    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          if (isNaN(val) || val <= 0) return { ...item, qty: 1 };
          if (!isPreOrder && product && val > product.stock) {
            alert(
              `Stok harian tidak mencukupi! Maksimal stok: ${product.stock}`,
            );
            return { ...item, qty: product.stock };
          }
          return { ...item, qty: val };
        }
        return item;
      }),
    );
  };

  const totalBelanja = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );

  // 1. Trigger saat tombol proses diklik (Validasi awal sebelum pilih pembayaran)
  const handleProceedClick = () => {
    if (cart.length === 0) return;

    if (isPreOrder && (!customerName || !pickupDate)) {
      alert("Mohon isi Nama Pemesan dan Tanggal Pengambilan untuk Pre-Order!");
      return;
    }

    // Munculkan popup pilihan pembayaran Cash / QRIS
    setShowPaymentModal(true);
  };

  // 2. Eksekusi Checkout setelah metode pembayaran dipilih ('Cash' atau 'QRIS')
  const handleCheckout = async (paymentMethod) => {
    setShowPaymentModal(false);
    setIsProcessing(true);

    try {
      const prefix = isPreOrder ? "PO" : "TRX";
      const kodeTrx = `${prefix}-${Date.now().toString().slice(-6)}`;

      const { data: trxData, error: trxError } = await supabase
        .from("transaksi")
        .insert([
          {
            kode_trx: kodeTrx,
            total_omset: totalBelanja,
            metode_pembayaran: paymentMethod,
          },
        ])
        .select("id")
        .single();

      if (trxError) throw trxError;
      const transaksiId = trxData.id;

      for (const item of cart) {
        const { error: detailError } = await supabase
          .from("detail_transaksi")
          .insert([
            {
              transaksi_id: transaksiId,
              produk_id: item.id,
              qty: item.qty,
              harga_jual_saat_ini: item.price,
              hpp_bahan_saat_ini: item.modalBahan,
              hpp_kemasan_saat_ini: item.biayaKemasan,
            },
          ]);

        if (detailError) throw detailError;

        if (!isPreOrder) {
          const sisaStok = item.stock - item.qty;
          const { error: stockError } = await supabase
            .from("produk")
            .update({ stok: sisaStok })
            .eq("id", item.id);

          if (stockError) throw stockError;
        }
      }

      setReceiptData({
        kode: kodeTrx,
        waktu: new Date().toLocaleString("id-ID"),
        items: [...cart],
        total: totalBelanja,
        kasir: user?.name || "Kasir",
        isPO: isPreOrder,
        pemesan: customerName || "-",
        telepon: customerPhone || "-",
        tglAmbil: pickupDate || "-",
        metodeBayar: paymentMethod,
      });

      setCart([]);
      setIsPreOrder(false);
      setCustomerName("");
      setCustomerPhone("");
      setPickupDate("");
      fetchProducts();
    } catch (error) {
      alert("Gagal memproses transaksi: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] dark:bg-zinc-900">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    // PERBAIKAN: Gunakan h-screen dan overflow-hidden agar aplikasi tidak bisa di-scroll ke bawah secara global
    <div className="h-screen overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 flex flex-col font-sans">
      <Head>
        <title>POS Kasir - Toko Roti Amira</title>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-receipt, #printable-receipt * { visibility: visible; }
            #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; color: black !important; }
            .no-print { display: none !important; }
          }
          /* Custom Scrollbar agar lebih rapi */
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .dark ::-webkit-scrollbar-thumb { background: #3f3f46; }
        `}</style>
      </Head>

      {/* Header Kasir - PERBAIKAN: Gunakan shrink-0 agar header tidak mengecil */}
      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 py-3 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥐</span>
          <h1 className="text-lg md:text-xl font-bold text-amber-900 dark:text-amber-400">
            Kasir Amira
          </h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <ThemeToggle />
          <button
            onClick={logout}
            className="p-2 w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all shadow-sm"
            title="Keluar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* Area Utama - PERBAIKAN: flex-1 dan overflow-hidden */}
      <div className="flex flex-1 overflow-hidden bg-gray-50 dark:bg-zinc-900/50">
        {/* Kiri: Daftar Produk (Scroll mandiri) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 relative">
          {/* Kolom Pencarian Sticky dengan Efek Kaca (Glassmorphism) & Bayangan Luar Pekat */}
          <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md p-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.2)] dark:shadow-[0_0_30px_rgba(0,0,0,0.9)] border border-gray-200/50 dark:border-zinc-700/50 flex items-center gap-3 shrink-0 sticky top-0 z-20">
            <span className="text-gray-400 pl-2">🔍</span>
            <input
              type="text"
              placeholder="Cari nama roti cepat..."
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              className="w-full bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
            />
            {searchProduct && (
              <button
                onClick={() => setSearchProduct("")}
                className="text-xs text-gray-400 hover:text-gray-600 px-2"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-6">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={!isPreOrder && p.stock <= 0}
                className={`bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border ${!isPreOrder && p.stock <= 0 ? "border-red-200 opacity-60 cursor-not-allowed" : "border-gray-100 hover:border-amber-400 dark:border-zinc-700 dark:hover:border-amber-500"} transition-all text-left group relative overflow-hidden flex flex-col`}
              >
                <div className="aspect-square bg-amber-50 dark:bg-zinc-700 w-full rounded-xl mb-3 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform">
                  🍞
                </div>
                <div className="flex-1 flex flex-col justify-between w-full">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm md:text-base line-clamp-2">
                    {p.name}
                  </h3>
                  <div className="mt-2">
                    <p className="text-amber-600 dark:text-amber-500 font-bold">
                      Rp {p.price.toLocaleString("id-ID")}
                    </p>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium flex justify-between">
                      <span>Stok: {p.stock}</span>
                      {!isPreOrder && p.stock <= 0 && (
                        <span className="text-red-500 font-bold">Habis</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>

        {/* Kanan: Sidebar Keranjang - PERBAIKAN: Layout ditahan agar tidak terdorong konten */}
        <aside className="w-80 lg:w-96 bg-white dark:bg-zinc-800 border-l border-gray-200 dark:border-zinc-700 flex flex-col shadow-xl z-20 shrink-0">
          {/* Header Sidebar (Statis) */}
          <div className="p-4 border-b border-gray-200 dark:border-zinc-700 space-y-3 shrink-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Pesanan Saat Ini
            </h2>

            <div className="bg-amber-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-amber-200 dark:border-zinc-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPreOrder}
                  onChange={(e) => setIsPreOrder(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-400">
                  Mode Pesanan Khusus (PO)
                </span>
              </label>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                Stok harian etalase tidak akan dipotong.
              </p>
            </div>

            {isPreOrder && (
              <div className="space-y-2 pt-1 animate-fadeIn">
                <input
                  type="text"
                  placeholder="Nama Pemesan / Acara *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs outline-none text-gray-800 dark:text-gray-200"
                />
                <input
                  type="text"
                  placeholder="No. Telepon"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs outline-none text-gray-800 dark:text-gray-200"
                />
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">
                    Tanggal Pengambilan *
                  </label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs outline-none text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Isi Keranjang (Scroll mandiri) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Belum ada pesanan
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-start gap-2"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight">
                      {item.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Rp {item.price.toLocaleString("id-ID")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-700 rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-600 rounded text-gray-600 dark:text-gray-200 shadow-sm"
                    >
                      -
                    </button>

                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) =>
                        handleDirectQtyChange(item.id, e.target.value)
                      }
                      className="w-10 text-center text-xs font-bold bg-transparent outline-none text-gray-800 dark:text-white"
                    />

                    <button
                      onClick={() => updateQty(item.id, 1)}
                      disabled={!isPreOrder && item.qty >= item.stock}
                      className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-600 rounded text-gray-600 dark:text-gray-200 shadow-sm disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded dark:hover:bg-red-900/20 shrink-0"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Pembayaran (Statis di Bawah) */}
          <div className="p-4 bg-gray-50 dark:bg-zinc-800/80 border-t border-gray-200 dark:border-zinc-700 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600 dark:text-gray-400 font-medium">
                Total:
              </span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                Rp {totalBelanja.toLocaleString("id-ID")}
              </span>
            </div>
            <button
              onClick={handleProceedClick}
              disabled={cart.length === 0 || isProcessing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg flex justify-center items-center gap-2"
            >
              {isProcessing
                ? "Memproses..."
                : isPreOrder
                  ? "Proses Pesanan (PO)"
                  : "Proses Pembayaran"}
            </button>
          </div>
        </aside>
      </div>

      {/* Modal Popup Pilih Metode Pembayaran (Cash / QRIS) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center space-y-4 border border-gray-100 dark:border-zinc-700 animate-fadeIn">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Pilih Metode Pembayaran
            </h3>
            <p className="text-xs text-gray-500">
              Total Tagihan:{" "}
              <span className="font-bold text-amber-600">
                Rp {totalBelanja.toLocaleString("id-ID")}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleCheckout("Cash")}
                className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 font-bold flex flex-col items-center gap-2 transition-all shadow-sm"
              >
                <span className="text-3xl">💵</span>
                <span>TUNAI (CASH)</span>
              </button>

              <button
                onClick={() => handleCheckout("QRIS")}
                className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-800 dark:text-blue-300 font-bold flex flex-col items-center gap-2 transition-all shadow-sm"
              >
                <span className="text-3xl">📱</span>
                <span>QRIS</span>
              </button>
            </div>

            <button
              onClick={() => setShowPaymentModal(false)}
              className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-semibold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Modal Struk */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            id="printable-receipt"
            className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 relative"
          >
            <button
              onClick={() => setReceiptData(null)}
              className="no-print absolute top-3 right-3 text-gray-400 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4 text-black">
              <h2 className="text-xl font-bold">TOKO ROTI AMIRA</h2>
              <p className="text-xs text-gray-600 mt-1">
                Jl. Raya Sukses No. 123, Surabaya
              </p>
              <div className="mt-2 inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-bold uppercase">
                {receiptData.isPO
                  ? "*** NOTA PRE-ORDER / ACARA ***"
                  : "STRUK PENJUALAN"}
              </div>
              <div className="text-xs text-gray-500 mt-2 flex justify-between">
                <span>{receiptData.waktu}</span>
                <span>{receiptData.kode}</span>
              </div>
              <div className="text-xs font-semibold text-gray-700 mt-1 text-left">
                Pembayaran:{" "}
                <span className="text-amber-600 uppercase">
                  {receiptData.metodeBayar}
                </span>
              </div>
              {receiptData.isPO && (
                <div className="text-left text-xs bg-gray-50 p-2 rounded mt-2 space-y-1">
                  <p>
                    <strong>Pemesan:</strong> {receiptData.pemesan}
                  </p>
                  <p>
                    <strong>Telepon:</strong> {receiptData.telepon}
                  </p>
                  <p>
                    <strong>Tgl Ambil:</strong> {receiptData.tglAmbil}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-4 text-sm text-black max-h-60 overflow-y-auto">
              {receiptData.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.qty} x Rp {item.price.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <p className="font-semibold mt-1">
                    Rp {(item.qty * item.price).toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 pt-3 text-black">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total</span>
                <span>Rp {receiptData.total.toLocaleString("id-ID")}</span>
              </div>
            </div>

            <div className="text-center mt-6 text-xs text-gray-500 text-black">
              <p>Kasir: {receiptData.kasir}</p>
              <p className="mt-1 font-medium">
                Terima Kasih Atas Kepercayaannya!
              </p>
            </div>

            <button
              onClick={handlePrint}
              className="no-print w-full mt-6 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              🖨️ Cetak Nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
