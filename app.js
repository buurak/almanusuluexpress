const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();

const fs = require('fs');

// Error logging function
function logError(error) {
    const logEntry = `${new Date().toISOString()} - ${error.message}\n${error.stack}\n\n`;
    fs.appendFileSync('error.log', logEntry);
}

// Global error handler
process.on('uncaughtException', (error) => {
    console.error('Beklenmeyen hata:', error);
    logError(error);
    
    // Verileri sıfırla
    kisiler = [];
    harcamalar = [];
    
    // Uygulamayı yeniden başlat
    if (server) {
        server.close(() => {
            console.log('Server kapatıldı, yeniden başlatılıyor...');
            server = app.listen(PORT, () => {
                console.log(`Server ${PORT} portunda yeniden başlatıldı`);
            });
        });
    }
});
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Verileri geçici olarak tutmak için
let kisiler = [];
let harcamalar = [];

// .env dosyasından GA ID'sini al
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

// Tüm sayfalara GA ID'sini gönder
app.use((req, res, next) => {
    res.locals.GA_MEASUREMENT_ID = GA_MEASUREMENT_ID;
    next();
});

// Ana sayfa
app.get('/', (req, res) => {
    const hesaplamalar = hesaplaBorc(kisiler, harcamalar);
    res.render('index', {
        kisiler: kisiler,
        harcamalar: harcamalar,
        hesaplamalar: hesaplamalar
    });
});

// Kişi ekleme
app.post('/kisi-ekle', (req, res) => {
    const { isim } = req.body;
    const hesaplamalar = hesaplaBorc(kisiler, harcamalar);

    // Kişi sayısı kontrolü
    if (kisiler.length >= 20) {
        return res.render('index', {
            kisiler,
            harcamalar,
            hesaplamalar,
            error: 'Maksimum 20 kişi ekleyebilirsiniz!'
        });
    }

    if (isim && !kisiler.includes(isim)) {
        kisiler.push(isim);
    } else {
        res.render('index', {
            kisiler,
            harcamalar,
            hesaplamalar,
            error: 'Bu isimde bir kişi zaten var!'
        });
    }
    res.redirect('/');
});

// Harcama ekleme
app.post('/harcama-ekle', (req, res) => {
    const { kisi, aciklama, tutar, katilimcilar } = req.body;
    const hesaplamalar = hesaplaBorc(kisiler, harcamalar);
    
    // Harcama sayısı kontrolü
    if (harcamalar.length >= 20) {
        return res.render('index', {
            kisiler,
            harcamalar,
            hesaplamalar,
            error: 'Maksimum 20 harcama ekleyebilirsiniz!'
        });
    }

    // Tutar kontrolü
    const tutarSayi = parseFloat(tutar);
    if (tutarSayi <= 0 || tutarSayi > 1000000) {
        return res.render('index', {
            kisiler,
            harcamalar,
            hesaplamalar,
            error: 'Tutar 0\'dan büyük ve 1.000.000\'dan küçük olmalıdır!'
        });
    }

    const odeyenlerArray = Array.isArray(kisi) ? kisi : [kisi];
    const katilimcilarArray = Array.isArray(katilimcilar) ? katilimcilar : [katilimcilar];

    if (odeyenlerArray.length > 0 && aciklama && tutarSayi && katilimcilarArray.length > 0) {
        harcamalar.push({
            odeyenler: odeyenlerArray,
            aciklama,
            tutar: tutarSayi,
            tarih: new Date(),
            katilimcilar: katilimcilarArray
        });
        
        // GA'ya olay gönder
        const eventData = {
            event_name: 'add_expense',
            currency: 'TRY',
            value: parseFloat(tutar),
            items: [{
                item_name: aciklama,
                price: parseFloat(tutar),
                quantity: 1
            }]
        };
        
        // Node için measurement protocol kullanarak event gönderme
        sendToGA4(eventData);
        
        res.redirect('/');
    } else {
        res.render('index', {
            kisiler,
            harcamalar,
            hesaplamalar,
            error: 'Tüm alanları doldurunuz!'
        });
    }
});

// GA4 Measurement Protocol için yardımcı fonksiyon
async function sendToGA4(eventData) {
    try {
        const response = await axios.post(
            `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`,
            {
                client_id: 'server_generated',
                events: [eventData]
            }
        );
        
        if (response.status !== 200) {
            console.error('GA event gönderilemedi');
        }
    } catch (error) {
        console.error('GA error:', error);
    }
}

// Sıfırlama route'u ekle
app.post('/sifirla', (req, res) => {
    kisiler = [];
    harcamalar = [];
    res.redirect('/');
});

// Harcama güncelleme sayfası
app.get('/harcama-duzenle/:id', (req, res) => {
    const harcama = harcamalar[req.params.id];
    if (!harcama) {
        return res.redirect('/');
    }
    res.render('harcama-duzenle', {
        harcama,
        harcamaId: req.params.id,
        kisiler
    });
});

// Harcama güncelleme işlemi
app.post('/harcama-guncelle/:id', (req, res) => {
    const { kisi, aciklama, tutar, katilimcilar } = req.body;
    const id = req.params.id;

    if (id >= 0 && id < harcamalar.length) {
        const odeyenlerArray = Array.isArray(kisi) ? kisi : [kisi];
        const katilimcilarArray = Array.isArray(katilimcilar) ? katilimcilar : [katilimcilar];

        harcamalar[id] = {
            odeyenler: odeyenlerArray,
            aciklama,
            tutar: parseFloat(tutar),
            tarih: harcamalar[id].tarih,
            katilimcilar: katilimcilarArray
        };
    }
    res.redirect('/');
});

// Harcama detay sayfası
app.get('/harcama/:id', (req, res) => {
    const harcama = harcamalar[req.params.id];
    if (!harcama) {
        return res.redirect('/');
    }

    // Bu harcamaya özel hesaplamalar yapılıyor
    const kisiBasiDusenMiktar = harcama.tutar / harcama.katilimcilar.length;
    const odeyenBasiMiktar = harcama.tutar / harcama.odeyenler.length;

    // Borç hesaplama
    const borclar = [];
    harcama.katilimcilar.forEach(katilimci => {
        if (!harcama.odeyenler.includes(katilimci)) {
            // Katılımcı ödeyici değilse, her ödeyiciye borçlanır
            harcama.odeyenler.forEach(odeyen => {
                borclar.push({
                    verici: odeyen,
                    alici: katilimci,
                    miktar: Number((odeyenBasiMiktar / harcama.katilimcilar.length).toFixed(2))
                });
            });
        }
    });

    const hesaplamalar = {
        toplamHarcama: harcama.tutar,
        kisiBasiHarcama: kisiBasiDusenMiktar,
        odeyenBasiHarcama: odeyenBasiMiktar,
        borclar: borclar
    };

    res.render('harcama-detay', {
        harcama,
        harcamaId: req.params.id,
        hesaplamalar
    });
});

// Borç hesaplama fonksiyonu
function hesaplaBorc(kisiler, harcamalar) {
    if (kisiler.length === 0) return {
        toplamHarcama: 0,
        kisiBasiHarcama: 0,
        kisiHarcamalari: {},
        borclar: []
    };

    // Her kişinin yaptığı harcamaları hesapla
    const kisiHarcamalari = {};
    kisiler.forEach(kisi => {
        kisiHarcamalari[kisi] = 0;
    });

    // Her harcama için katılımcılar arasında eşit bölüştürme
    harcamalar.forEach(harcama => {
        const kisiBasiDusenMiktar = harcama.tutar / harcama.katilimcilar.length;
        harcama.katilimcilar.forEach(katilimci => {
            kisiHarcamalari[katilimci] = (kisiHarcamalari[katilimci] || 0) + kisiBasiDusenMiktar;
        });
    });

    // Toplam harcama ve kişi başı ortalama harcama
    const toplamHarcama = harcamalar.reduce((sum, h) => sum + h.tutar, 0);
    const kisiBasiHarcama = kisiler.length > 0 ? toplamHarcama / kisiler.length : 0;

    // Borç hesaplama
    const borclar = [];
    const odemeler = {};

    // Her kişinin toplam ödemesi gereken miktarı hesapla
    harcamalar.forEach(harcama => {
        const kisiBasiOdeme = harcama.tutar / harcama.odeyenler.length;
        harcama.odeyenler.forEach(odeyen => {
            if (!odemeler[odeyen]) {
                odemeler[odeyen] = 0;
            }
            odemeler[odeyen] += kisiBasiOdeme;
        });
    });

    // Her kişinin borç durumunu hesapla
    kisiler.forEach(verici => {
        kisiler.forEach(alici => {
            if (verici !== alici) {
                const vericininOdemesi = odemeler[verici] || 0;
                const vericininHarcamasi = kisiHarcamalari[verici];
                const alicininHarcamasi = kisiHarcamalari[alici];
                const alicininOdemesi = odemeler[alici] || 0;

                if (vericininOdemesi > vericininHarcamasi && alicininOdemesi < alicininHarcamasi) {
                    const borcMiktari = Math.min(
                        vericininOdemesi - vericininHarcamasi,
                        alicininHarcamasi - alicininOdemesi
                    );

                    if (borcMiktari > 0) {
                        borclar.push({
                            verici,
                            alici,
                            miktar: Number(borcMiktari.toFixed(2))
                        });
                        odemeler[alici] += borcMiktari;
                        odemeler[verici] -= borcMiktari;
                    }
                }
            }
        });
    });

    return {
        toplamHarcama,
        kisiBasiHarcama,
        kisiHarcamalari,
        borclar
    };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 