/**
 * words.js — Indonesian word corpus (3–8 letters).
 *
 * This is the *content* layer. It is intentionally the only place that
 * knows about actual vocabulary, so it can later be swapped for a
 * server-delivered dictionary without touching the engine:
 *
 *   import { WORDS } from './words.js'        →  await api.fetchDictionary()
 *
 * Stored as space-separated strings purely for payload size; the module
 * exports a normalised, de-duplicated, uppercase array.
 */

const RAW = [
  /* --- 3 letters ------------------------------------------------- */
  `ada air aku ala alu apa api asa asi aur bab bah bak bal ban bar bau bis bui
   cat cor dam dan dia doa dor dua duo dus eja eka gas gen gua hal hem ibu ide
   ijo ini iri isi itu jam jas jin jua juz kak kan kap kas kau kek kok kol kos
   kue lab lah lak lap las lem mak mal mas mat mau mei mie mil mur neo net nih
   nil nol non oli oto pak pal pan pas pel pen per pia pil pin pir pos pot pun
   rak ram rap ras rem ria roh rok rol sah sel sen set sia sih sim sip sir sok
   sol sop sua sub sun sup sus tag tak tas tau teh tes tik tim tip toh tok tol
   ton top tua ubi uji ulu uni vas yah yuk`,

  /* --- 4 letters ------------------------------------------------- */
  `abad abai abon acak acar adik adil aduk agak agar agen ajak ajar akal akan
   akar akta aksi alam alas alat alih alis amal aman amat anak anda anti apel
   arah arak arif arus asah asal asam asap asas asin asli atap atas atau atur
   awal awan ayah ayam ayat ayun babi bagi baik bait baja baju baka baku bala
   bang bank bara baru basa basi batu bawa bayi beda beli bela besi biar bibi
   bila bina bini biru bisa bius blok bola buah buat buka buku bumi buru busa
   buta cabe cari cara ceri ciri coba cuci cuma dada dagu dahi daki dana daun
   dari dasi data debu demi desa dewa dewi dini diri dosa duka duta ejek ekor
   elak emas enak erat gaji gala gali gang gaun gigi giat gila goda guci gula
   guna guru haji hama hari hati haus hias hina hobi ibas ikan ikat ilmu imam
   inti iris isap itik jadi jaga jahe jala jamu jari jasa jauh jeda jiwa juga
   judi juru kaca kado kaki kali kami kamu kaos kaki kata kaya keju kena kera
   kian kios kira kita kode kopi kota kuat kubu kuda kuku kutu lagi lagu lain
   laju laki lama laut lesu lima lipa luas luka lupa lusa madu maju maka mana
   masa mata mati maut meja muda muka mutu nadi naga naik nama nasi niat obat
   otak otot pada padi paha paku pala palu para pena pipa pola raga rasa raya
   ribu roda roti rugi saja saku sama sapi sapu satu seni siap siku sisa sisi
   situ soal sore suci suka susu tahu tamu tari tiap tiba tiga tidu toko tuju
   tuna uang ubah ukur ular ulat umum ungu upah urat usia usir utuh`,

  /* --- 5 letters ------------------------------------------------- */
  `abang abadi acara adzan agama ahlak aduan akhir aliran ambil ampas anak
   angin angka angsa anjing antar aneka apotek arang aroma artis asrama atlet
   awang ayunan badan bagus bahan bahas bahaya bakar bakat balas balok bambu
   bandar bangku banjir barat baris batas batik bawah bayar bebas beban bekal
   belah belum benar bening bensin beras berat berita besar biasa bibit bidan
   bijak bimbing bintang bisnis bolos bosan botol buaya bubur budak bugar
   bukit bulan bunga bunyi burung busur cabai cacat cagar cahaya camat campur
   candi cepat cerah cerita cetak cinta cocok cukup curam dagang daging dahan
   dalam damai dampak danau dapat dapur darah dasar datang dekat delapan
   dengan derap desain detak dinas dinding dingin diskon dokter domba dompet
   dorong dosen duduk dukun ekor elang emosi empat enggan gadis gagal gajah
   galak gambar ganti garam garis gawat gelap gelas gemar gempa gerak gigit
   ginjal gosok gudang gugur gunung hadap hafal halal halus hamil hancur
   hangat harga harum hasil hebat helai hemat hewan hidup hijau hilang hitam
   hitung hormat hujan hukum huruf hutan ideal ikhlas ilmiah indah induk
   inovasi intan irama istri jabat jadwal jagung jahat jajan jalan jalur
   jambu jamur janji jarak jarum jasad jatuh jawab jelas jemur jenis jerat
   jeruk jujur jumat jumlah junior kabar kabel kabut kacang kadar kaget kail
   kalah kalau kamar kanan kandang kantor kapal kapas karet karib kartu karya
   kasar kasih kasus katak kawan kayak kebun kecil kedai kelas kemah kembali
   kenal kepal kerak keras kereta kerja kertas ketan ketat kilat kirim
   kolam koleksi kompas kondisi korban kosong kotak kuali kuasa kubur kucing
   kuliah kulit kunci kuning kurang kursi kurus labuh ladang lagu lahan lalat
   lambat lampu lancar landai langit lapar lapis larang lawan layar lebar
   lebih legenda leher lemah lembab lembar lembut lengan lepas lestari libur
   lidah lipat lisan listrik logam lomba lompat longgar lubang lucu lulus
   lumpur lurus lutut macan macam madya mahal makan makna maksud malam malas
   mampu mandi manis manusia marah masak masih masuk masyarakat mawar medan
   megah melati memang menang mendung merah merdeka mesin miskin milik mimpi
   minat minggu minum mobil modal modern mohon monyet motor muara mudah mulai
   mulut murah murid musim mutiara naskah nanas nafas negara nelayan nikmat
   nilai nyala nyaman nyanyi ombak orang pagar paham pahit pakai paket panas
   pandai panen panci pantai papan parah parkir pasar pasir patah pecah pedas
   pekan pelan peluk penuh perak perang peras perlu pesan pesta petani piala
   pidato pihak pilih pintar pintu pisau pohon pojok polisi pondok potong
   proses pukul pulau puluh punya pusat putih putri racun radio rajin rakit
   ramah rambut rapat ratus rebus rekan rendah resep rimba rindu ringan
   rumah rumput rusak sabar sabun sadar salah salam sambil sampah sampai
   sandal santai sarang sawah sayur sebab sedih segar sehat sejuk sekali
   selalu semua senang sendok senyum sepatu sepeda serta siang siapa sikat
   simpan sinar singa sisir sopan sudah sulit sumur sungai surat susun sutra
   tabung tahan tahun takut taman tanah tanam tangan tangga tanpa tarik
   tawar tebal teduh tegak teman tempat tenang tepat tepung terang terus
   tidak tidur tikar tikus timur tinggi tipis titik tolak tomat tubuh tugas
   tukar tulis tunas turun tutup udara ujian unggul untuk usaha utara waktu
   wangi warga warna warta wisata yakin`,
].join(' ');

/** Uppercase, de-duplicated, length-filtered corpus. */
export const WORDS = Object.freeze(
  [...new Set(
    RAW.split(/\s+/)
      .map((w) => w.trim().toUpperCase())
      .filter((w) => /^[A-Z]{3,10}$/.test(w))
  )].sort()
);

/** Shortest accepted word. */
export const MIN_WORD_LENGTH = 3;
