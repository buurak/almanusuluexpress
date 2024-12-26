const request = require('supertest');
const app = require('../app');

describe('Harcama Takip Uygulaması Testleri', () => {
    beforeEach(() => {
        // Her test öncesi verileri sıfırla
        app.kisiler = [];
        app.harcamalar = [];
    });

    describe('Kişi İşlemleri', () => {
        test('Kişi ekleme başarılı olmalı', async () => {
            const res = await request(app)
                .post('/kisi-ekle')
                .send({ isim: 'Ahmet' });
            expect(res.statusCode).toBe(302); // Yönlendirme
            expect(app.kisiler).toContain('Ahmet');
        });

        test('Aynı isimde kişi eklenemez', async () => {
            await request(app).post('/kisi-ekle').send({ isim: 'Ahmet' });
            await request(app).post('/kisi-ekle').send({ isim: 'Ahmet' });
            expect(app.kisiler.filter(k => k === 'Ahmet').length).toBe(1);
        });
    });

    describe('Harcama İşlemleri', () => {
        beforeEach(async () => {
            await request(app).post('/kisi-ekle').send({ isim: 'Ahmet' });
            await request(app).post('/kisi-ekle').send({ isim: 'Mehmet' });
        });

        test('Harcama ekleme başarılı olmalı', async () => {
            const harcama = {
                kisi: ['Ahmet'],
                aciklama: 'Test Harcama',
                tutar: 100,
                katilimcilar: ['Ahmet', 'Mehmet']
            };
            const res = await request(app)
                .post('/harcama-ekle')
                .send(harcama);
            expect(res.statusCode).toBe(302);
            expect(app.harcamalar.length).toBe(1);
        });

        test('Geçersiz harcama eklenemez', async () => {
            const harcama = {
                kisi: [],
                aciklama: 'Test Harcama',
                tutar: 100,
                katilimcilar: ['Ahmet']
            };
            await request(app).post('/harcama-ekle').send(harcama);
            expect(app.harcamalar.length).toBe(0);
        });

        test('Harcama güncelleme başarılı olmalı', async () => {
            // Önce harcama ekle
            await request(app).post('/harcama-ekle').send({
                kisi: ['Ahmet'],
                aciklama: 'Test Harcama',
                tutar: 100,
                katilimcilar: ['Ahmet', 'Mehmet']
            });

            // Sonra güncelle
            const res = await request(app)
                .post('/harcama-guncelle/0')
                .send({
                    kisi: ['Mehmet'],
                    aciklama: 'Güncellenmiş Harcama',
                    tutar: 200,
                    katilimcilar: ['Ahmet', 'Mehmet']
                });

            expect(res.statusCode).toBe(302);
            expect(app.harcamalar[0].tutar).toBe(200);
            expect(app.harcamalar[0].aciklama).toBe('Güncellenmiş Harcama');
        });
    });

    describe('Hesaplama İşlemleri', () => {
        beforeEach(async () => {
            await request(app).post('/kisi-ekle').send({ isim: 'Ahmet' });
            await request(app).post('/kisi-ekle').send({ isim: 'Mehmet' });
            await request(app).post('/harcama-ekle').send({
                kisi: ['Ahmet'],
                aciklama: 'Test Harcama',
                tutar: 100,
                katilimcilar: ['Ahmet', 'Mehmet']
            });
        });

        test('Kişi başı harcama doğru hesaplanmalı', () => {
            const hesaplamalar = app.hesaplaBorc(app.kisiler, app.harcamalar);
            expect(hesaplamalar.kisiBasiHarcama).toBe(50);
        });

        test('Borç hesaplaması doğru yapılmalı', () => {
            const hesaplamalar = app.hesaplaBorc(app.kisiler, app.harcamalar);
            expect(hesaplamalar.borclar.length).toBeGreaterThan(0);
            expect(hesaplamalar.borclar[0].miktar).toBe(50);
        });
    });
}); 