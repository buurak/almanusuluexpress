const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Verileri geçici olarak tutmak için
let kisiler = [];
let harcamalar = [];

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
    if (isim && !kisiler.includes(isim)) {
        kisiler.push(isim);
    } else {
        const hesaplamalar = hesaplaBorc(kisiler, harcamalar);
        res.render('index', {
            kisiler: kisiler,
            harcamalar: harcamalar,
            hesaplamalar: hesaplamalar,
            error: 'Bu isimde bir kişi zaten var!'
        });
    }
    res.redirect('/');
});

// Harcama ekleme
app.post('/harcama-ekle', (req, res) => {
    const { kisi, aciklama, tutar, katilimcilar } = req.body;
    const odeyenlerArray = Array.isArray(kisi) ? kisi : [kisi];
    const katilimcilarArray = Array.isArray(katilimcilar) ? katilimcilar : [katilimcilar];

    if (odeyenlerArray.length > 0 && aciklama && tutar && katilimcilarArray.length > 0) {
        harcamalar.push({
            odeyenler: odeyenlerArray,
            aciklama,
            tutar: parseFloat(tutar),
            tarih: new Date(),
            katilimcilar: katilimcilarArray
        });
    }
    res.redirect('/');
});

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