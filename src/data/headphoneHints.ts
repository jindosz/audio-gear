// 헤드폰 주요 특징 추정 데이터(Claude가 확실히 아는 모델·시리즈만, 2026-10 작성).
// 키는 기기 이름의 앞부분. 이름이 이 키로 시작하면(공백·기호·대소문자 무시) 그 값을 쓰고,
// 여러 키가 맞으면 더 긴(구체적인) 키가 이긴다. 예) "Audeze LCD-2 Closed"가 "Audeze LCD-2"보다 우선.
// 모르거나 헷갈리는 모델은 일부러 넣지 않았다. 코덱은 확실한 모델만 적었다.
// 연결: 블루투스 헤드폰에 3.5mm 등 유선 입력이 있으면 'both', 확실하지 않으면 'wireless'
import type { Acoustic, Codec, Connection } from '../types'

export interface SpecHint {
  connection?: Connection
  acoustic?: Acoustic
  anc?: boolean
  codecs?: Codec[]
}

// 자주 쓰는 조합
const wo: SpecHint = { connection: 'wired', acoustic: 'open' }
const wc: SpecHint = { connection: 'wired', acoustic: 'closed' }
const ws: SpecHint = { connection: 'wired', acoustic: 'semi-open' }
const bc: SpecHint = { connection: 'wireless', acoustic: 'closed' }
const bo: SpecHint = { connection: 'wireless', acoustic: 'open' }
const bcAnc: SpecHint = { connection: 'wireless', acoustic: 'closed', anc: true }
const bothAnc: SpecHint = { connection: 'both', acoustic: 'closed', anc: true }
const wcAnc: SpecHint = { connection: 'wired', acoustic: 'closed', anc: true }
const SBC_AAC: Codec[] = ['SBC', 'AAC']
const SBC_AAC_LDAC: Codec[] = ['SBC', 'AAC', 'LDAC']
const w = (h: SpecHint, codecs: Codec[]): SpecHint => ({ ...h, codecs })

export const HEADPHONE_HINTS: [string, SpecHint][] = [
  // ---- Sennheiser ----
  ['Sennheiser HD 600', wo], ['Sennheiser HD 650', wo], ['Sennheiser HD 6XX', wo], ['Sennheiser x Drop HD 6XX', wo],
  ['Sennheiser x Massdrop HD6XX', wo], ['Drop hd 6XX', wo], ['Sennheiser HD 660', wo], ['Sennheiser HD 58X', wo],
  ['Sennheiser x Drop HD58X', wo], ['Sennheiser x Massdrop HD-58X', wo], ['Drop hd 58X', wo], ['Sennheiser HD 580', wo],
  ['Sennheiser HD 800', wo], ['Sennheiser HD 8XX', wo], ['Sennheiser HD 700', wo], ['Sennheiser HD 560', wo],
  ['Sennheiser HD 565', wo], ['Sennheiser HD 575', wo], ['Sennheiser HD 595', wo], ['Sennheiser HD 598', wo],
  ['Sennheiser HD 598 CS', wc], ['Sennheiser HD 599', wo], ['Sennheiser HD 558', wo], ['Sennheiser HD 555', wo],
  ['Sennheiser HD 550', wo], ['Sennheiser HD 545', wo], ['Sennheiser HD 540', wo], ['Sennheiser HD 559', wo],
  ['Sennheiser HD 569', wc], ['Sennheiser HD 505', wo], ['Sennheiser HD 515', wo], ['Sennheiser HD 518', wo],
  ['Sennheiser HD 490 Pro', wo], ['Sennheiser HD 400 Pro', wo], ['Sennheiser HD 414', wo], ['Sennheiser HD 424', wo],
  ['Sennheiser HD 25', wc], ['Sennheiser HD25', wc], ['Sennheiser HD 280 Pro', wc], ['Sennheiser HD 300 Pro', wc],
  ['Sennheiser HD 380 Pro', wc], ['Sennheiser HD 200 Pro', wc], ['Sennheiser HD 620S', wc], ['Sennheiser HD 630VB', wc],
  ['Sennheiser HD 820', wc], ['Sennheiser HD 419', wc], ['Sennheiser HD 428', wc], ['Sennheiser HD 429', wc],
  ['Sennheiser HD 438', wc], ['Sennheiser HD 439', wc], ['Sennheiser HD 448', wc], ['Sennheiser HD 449', wc],
  ['Sennheiser HD 4.40BT', bc], ['Sennheiser HD 4.50 BTNC', bcAnc], ['Sennheiser HD 450BT', bcAnc],
  ['Sennheiser HE 1', wo], ['Sennheiser HE1', wo], ['Sennheiser HE 60', wo], ['Sennheiser HE 90', wo],
  ['Sennheiser PX 100', wo], ['Sennheiser PX 200', wc], ['Sennheiser PXC 350', wcAnc], ['Sennheiser PXC 450', wcAnc],
  ['Sennheiser PXC 550', bothAnc],
  ['Sennheiser Momentum 3 Wireless', w(bothAnc, ['SBC', 'AAC', 'aptX'])],
  ['Sennheiser Momentum 4', w(bothAnc, ['SBC', 'AAC', 'aptX', 'aptX Adaptive'])],
  ['Sennheiser Momentum Wireless', bothAnc], ['Sennheiser Momentum On-Ear', wc], ['Sennheiser Momentum Over-Ear 1.0', wc],
  ['Sennheiser ACCENTUM', bcAnc], ['Sennheiser MM 550', bcAnc],
  ['Sennheiser RS 160', bc], ['Sennheiser RS 170', bc], ['Sennheiser RS 175', bc], ['Sennheiser RS 195', bc],
  ['Sennheiser RS 185', bo], ['Sennheiser RS 220', bo],
  ['Sennheiser PC37X', wo], ['Sennheiser PC38X', wo], ['Sennheiser x Drop PC38X', wo], ['Drop + Sennheiser PC38X', wo],
  ['EPOS x Drop PC38X', wo], ['EPOS×DROP PC38X', wo], ['Sennheiser GAME ONE', wo], ['EPOS Sennheiser Game Zero', wc],
  ['EPOS Sennheiser GSP 600', wc], ['EPOS GSP 600', wc], ['EPOS H6PRO Closed', wc], ['EPOS H6PRO Open', wo],
  ['EPOS H6 Pro Open', wo],

  // ---- Sony ----
  ['Sony MDR-7502', wc], ['Sony MDR-7505', wc], ['Sony MDR-7506', wc], ['Sony MDR-7509', wc], ['Sony MDR-7520', wc],
  ['Sony MDR-V6', wc], ['Sony MDR-V600', wc], ['Sony MDR-V700', wc], ['Sony MDR-V900', wc], ['Sony MDR-V500', wc],
  ['Sony MDR-CD900ST', wc], ['Sony MDR-M1ST', wc], ['Sony MDR-M1', wc], ['Sony MDR-MV1', wo], ['Sony MDR-SA1000', wo],
  ['Sony MDR-SA3000', wo], ['Sony MDR-SA5000', wo], ['Sony MDR-MA900', wo], ['Sony MDR-F1', wo], ['Sony MDR-R10', wc],
  ['Sony MDR-Z7', wc], ['Sony MDR-Z1R', wc], ['Sony MDR-Z1000', wc], ['Sony MDR-1A', wc], ['Sony MDR-1R', wc],
  ['Sony MDR-1RBT', bc], ['Sony MDR-XB', wc], ['Sony MDR-ZX110', wc], ['Sony zx110', wc], ['Sony MDR-ZX110NC', wcAnc],
  ['Sony MDR-ZX310', wc], ['Sony MDR-ZX700', wc], ['Sony MDR-ZX1000', wc], ['Sony MDR-ZX770BN', bcAnc],
  ['Sony MDR-XB950N1', bcAnc], ['Sony MDR-XB950B1', bc], ['Sony MDR-CD3000', wc], ['Sony MDR-DS6000', bc],
  ['Sony MDR-1000X', w(bothAnc, SBC_AAC_LDAC)],
  ['Sony WH-1000XM2', w(bothAnc, ['SBC', 'AAC', 'aptX', 'aptX HD', 'LDAC'])],
  ['Sony WH-1000XM3', w(bothAnc, SBC_AAC_LDAC)], ['Sony WH-1000XM4', w(bothAnc, SBC_AAC_LDAC)],
  ['Sony WH-1000XM5', w(bothAnc, SBC_AAC_LDAC)], ['Sony WH-1000XM6', w(bothAnc, ['SBC', 'AAC', 'LDAC', 'LC3'])],
  ['Sony 1000X The ColleXion', bothAnc], ['Sony WH1000XX The Collexion', bothAnc],
  ['Sony WH-CH510', w(bc, SBC_AAC)], ['Sony WH-CH520', w(bc, SBC_AAC)], ['Sony WH-CH500', bc], ['Sony WH-CH400', bc],
  ['Sony WH-CH530', bc], ['Sony WH-CH700N', bcAnc], ['Sony WH-CH710N', bcAnc], ['Sony WH-CH720N', w(bcAnc, SBC_AAC)],
  ['Sony WH-H900N', bothAnc], ['Sony WH-H910N', bothAnc], ['Sony WH-XB700', bc], ['Sony WH-XB900N', bothAnc],
  ['Sony WH-XB910N', bothAnc], ['Sony ULT WEAR', w(bothAnc, SBC_AAC_LDAC)], ['Sony INZONE H9', bcAnc],
  ['Sony INZONE H7', bc], ['Sony INZONE H5', bc], ['Sony INZONE H3', wc], ['Sony PULSE 3D', bc],
  ['PlayStation Pulse 3D', bc], ['Sony Pulse Elite', bc], ['PlayStation Pulse Elite', bc],

  // ---- Bose / Apple / Beats ----
  ['Bose QuietComfort 35', w(bothAnc, SBC_AAC)], ['Bose QuietComfort 45', w(bothAnc, SBC_AAC)],
  ['Bose QC45', w(bothAnc, SBC_AAC)], ['Bose QuietComfort SE', w(bothAnc, SBC_AAC)],
  ['Bose QuietComfort SC', w(bothAnc, SBC_AAC)],
  ['Bose QuietComfort Ultra', w(bothAnc, ['SBC', 'AAC', 'aptX Adaptive'])],
  ['Bose QC Ultra', w(bothAnc, ['SBC', 'AAC', 'aptX Adaptive'])],
  ['Bose Noise Cancelling Headphones 700', w(bothAnc, SBC_AAC)], ['Bose NC700', w(bothAnc, SBC_AAC)],
  ['Bose QuietComfort 15', wcAnc], ['Bose QuietComfort 25', wcAnc], ['Bose QuietComfort 3', wcAnc],
  ['Bose SoundLink', bc], ['Bose SoundTrue', wc], ['Bose AE2', wc],
  ['Apple AirPods Max', w(bcAnc, SBC_AAC)], ['Apple Airpod Max', w(bcAnc, SBC_AAC)],
  ['Beats Studio Pro', w(bothAnc, SBC_AAC)], ['Beats Studio3 Wireless', w(bothAnc, SBC_AAC)],
  ['Beats Solo Pro', w(bcAnc, SBC_AAC)], ['Beats Solo3', w(bc, SBC_AAC)], ['Beats Solo 4', w(bc, SBC_AAC)],
  ['Beats Pro', wc], ['Beats EP', wc], ['Beats Solo HD', wc], ['Beats Mixr', wc],

  // ---- Audeze ----
  ['Audeze LCD', wo], ['Audeze lcdx', wo], ['Audeze LCD-2 Closed', wc], ['Audeze LCD-XC', wc],
  ['Audeze EL-8 Closed', wc], ['Audeze EL-8 Open', wo], ['Audeze CRBN', wo], ['Audeze MM-100', wo],
  ['Audeze MM100', wo], ['Audeze MM-500', wo], ['Audeze SINE', wc], ['Audeze Maxwell', w(bc, SBC_AAC_LDAC)],
  ['Audeze Mobius', bc], ['Audeze Penrose', bc],

  // ---- HIFIMAN (거의 전부 유선·오픈 평판형) ----
  ['HIFIMAN', wo], ['Hifiman', wo], ['HIFIMAN Ananda BT', bo], ['HIFIMAN Deva', { acoustic: 'open' }],
  ['HIFIMAN Sundara Closed', wc], ['HIFIMAN sundara closed', wc], ['HIFIMAN Sundara-C', wc],
  ['HIFIMAN HE-R9', wc], ['HIFIMAN HE-R10', wc], ['HIFIMAN Audivina', wc], ['HIFIMAN Edition S', {}], // 오픈·밀폐 전환형이라 비워 둔다
  ['HIFIMAN x ASUS ROG Kithara', wo], ['ASUS ROG x Hifiman Kithara', wo], ['ASUS ROG Kithara', wo], ['ROG Kithara', wo],
  ['Drop + Hifiman HE-4xx', wo], ['HIFIMAN x Drop HE-5XX', wo],

  // ---- Beyerdynamic ----
  ['Beyerdynamic DT 770', wc], ['Beyerdynamic DT770', wc], ['Beyerdynamic DT-770', wc], ['Beyerdynamic dt 770', wc],
  ['Beyerdynamic DT 990', wo], ['Beyerdynamic DT990', wo], ['Beyerdynamic dt 990', wo],
  ['Beyerdynamic DT 880', ws], ['Beyerdynamic DT880', ws], ['Beyerdynamic dt 880', ws],
  ['Beyerdynamic DT 1770', wc], ['Beyerdynamic DT 177X', wc], ['Beyerdynamic DT 1990', wo], ['Beyerdynamic DT1990', wo],
  ['Beyerdynamic DT 700 Pro X', wc], ['Beyerdynamic DT 900 Pro X', wo], ['Beyerdynamic DT 150', wc],
  ['Beyerdynamic DT 100', wc], ['Beyerdynamic DT 250', wc], ['Beyerdynamic DT 240', wc], ['Beyerdynamic DT 1350', wc],
  ['Beyerdynamic DT 48', wc], ['Beyerdynamic T1', wo], ['Beyerdynamic T5', wc], ['Beyerdynamic T70', wc],
  ['Beyerdynamic T90', wo], ['Beyerdynamic Custom One Pro', wc], ['Beyerdynamic Custom Studio', wc],
  ['Beyerdynamic Amiron Home', wo], ['Beyerdynamic Amiron Wireless', bc], ['Beyerdynamic Aventho Wireless', bc],
  ['Beyerdynamic Aventho 300', bcAnc], ['Beyerdynamic Lagoon', bcAnc], ['Beyerdynamic MMX 300', wc],
  ['Beyerdynamic MMX 330 Pro', wo], ['Beyerdynamic MMX 200 Wireless', bc], ['Beyerdynamic TYGR 300', wo],
  ['Beyerdynamic DTX 300p', wc], ['Beyerdynamic DTX 350', wc], ['Beyerdynamic ET1000', wo],

  // ---- Audio-Technica ("Audio Technica" 표기도 같이) ----
  ['Audio-Technica ATH-M', wc], ['Audio Technica ATH-M', wc], ['Audio-Technica ATH-M50xBT', bc],
  ['Audio-Technica ATH-R', wo], ['Audio Technica ATH-R', wo], ['Audio Technica R', wo],
  ['Audio-Technica x APOS Audio ATH-R70x', wo], ['Audio-Technica ATH-AD', wo], ['Audio Technica ATH-AD', wo],
  ['Audio Technica AD500x', wo], ['Audio-Technica ATH-ADX', wo], ['Audio Technica ADX7000', wo],
  ['Audio-Technica ATH-A', wc], ['Audio-Technica ATH-W', wc], ['Audio Technica ATH-W', wc],
  ['Audio-Technica ATH-WS', wc], ['Audio-Technica ATH-MSR7', wc], ['Audio-Technica ATH-MSR7NC', wcAnc],
  ['Audio-Technica ATH-ANC900BT', bcAnc], ['Audio-Technica ATH-ANC7', wcAnc], ['Audio-Technica ATH-ANC9', wcAnc],
  ['Audio-Technica ATH-ANC70', wcAnc], ['Audio-Technica ATH-DSR9BT', bc], ['Audio-Technica ATH-ES', wc],
  ['Audio-Technica ATH-AWAS', wc], ['Audio-Technica ATH-AWKT', wc], ['Audio Technica AWAS', wc],
  ['Audio Technica AWKG', wc], ['Audio Technica ATH-WP900', wc], ['Audio-Technica ATH-HL7BT', bo],
  ['Audio-Technica ATH-G1WL', bc], ['Audio-Technica ATH-GDL3', wo], ['Audio-Technica ATH-GL3', wc],
  ['Audio-Technica ATH-PRO700', wc], ['Audio-Technica ATH-FC700', wc], ['Audio-Technica BPHS1', wc],
  ['Audio-Technica ATH-AP2000Ti', wc], ['Audio-Technica ATH-AVA500', wo], ['Audio Technica ATH-AVA500', wo],

  // ---- AKG ----
  ['AKG K701', wo], ['AKG K702', wo], ['AKG K712', wo], ['AKG K7XX', wo], ['AKG 7XX', wo], ['AKG K612', wo],
  ['AKG K601', wo], ['AKG K501', wo], ['AKG K812', wo], ['AKG K1000', wo], ['AKG K245', wo], ['AKG Q701', wo],
  ['AKG K240', ws], ['AKG K271', wc], ['AKG K275', wc], ['AKG K361', wc], ['AKG K371', wc], ['AKG K361BT', bc],
  ['AKG K550', wc], ['AKG K553', wc], ['AKG K872', wc], ['AKG K92', wc], ['AKG K52', wc], ['AKG K72', wc],
  ['AKG K44', wc], ['AKG K81', wc], ['AKG K167', wc], ['AKG K267', wc], ['AKG K67', wc], ['AKG K182', wc],
  ['AKG K619', wc], ['AKG Q460', wc], ['AKG N60 NC Wireless', bcAnc], ['AKG N60 NC', wcAnc],
  ['AKG N700NC', bcAnc], ['AKG N9 Hybrid', bcAnc], ['AKG Y50BT', bc],

  // ---- Focal ----
  ['Focal Utopia', wo], ['Focal Clear', wo], ['Focal Elex', wo], ['Focal x Massdrop Elex', wo], ['Focal Elear', wo],
  ['Focal Hadenys', wo], ['Focal Stellia', wc], ['Focal Elegia', wc], ['Focal Celestee', wc], ['Focal Radiance', wc],
  ['Focal Azurys', wc], ['Focal Azuyrs', wc], ['Focal Listen', wc], ['Focal Lensys', wc], ['Focal Spirit', wc],
  ['Focal Bathys', w(bothAnc, ['SBC', 'AAC', 'aptX Adaptive'])],

  // ---- 오픈형이 대부분인 브랜드 ----
  ['Grado', wo], ['Grado GW100', bo], ['Stax', wo], ['Abyss', wo], ['Raal', wo], ['RAAL', wo], ['Rosson Audio Design RAD-0', wo],
  ['Sendy Aiva', wo], ['Sendy Audio Aiva', wo], ['Sendy Peacock', wo], ['Grell', wo], ['Drop + Grell OAE1', wo],
  ['Massdrop + Grell OAE1', wo], ['Oppo PM1', wo], ['Oppo PM2', wo], ['Oppo PM3', wc],
  ['Philips SHP9500', wo], ['Philips SHP9600', wo], ['Phillips SHP9500', wo], ['Phillips SHP9600', wo],
  ['Philips Fidelio X', wo], ['Philips X3', wo], ['Philips x2hr', wo], ['Philips Fidelio M', wc],
  ['Philips Fidelio NC1', wcAnc], ['Neumann NDH20', wc], ['Neumann NDH30', wo],

  // ---- Koss ----
  ['Koss Porta Pro', wo], ['Koss porta pro', wo], ['Koss Porta Pro Wireless', bo], ['Koss x Massdrop Porta Pro X', wo],
  ['Koss x Supreme PortaPro', wo], ['Koss iPorta Pro', wo], ['Koss SportaPro', wo], ['Koss KSC75', wo],
  ['Koss x Drop KSC75X', wo], ['Koss KSC21', wo], ['Koss KPH30', wo], ['Koss KPH40', wo], ['Koss ESP950', wo],
  ['Koss ESP95X', wo], ['Koss KTXPRO1', wo], ['Koss Pro4AA', wc], ['Koss Pro4S', wc], ['Koss SP330', wc],
  ['Koss SP540', wc], ['Koss UR 20', wc], ['Koss UR 29', wc], ['Koss BT540i', bc], ['Koss PRO DJ 100', wc],

  // ---- Meze / ZMF / Dan Clark Audio ----
  ['Meze 99', wc], ['Meze Audio 99', wc], ['Meze 88 Classics', wc], ['Meze Empyrean', wo], ['Meze Audio Empyrean', wo],
  ['Meze Elite', wo], ['Meze Audio Elite', wo], ['Meze Liric', wc], ['Meze Audio Liric', wc], ['Meze Poet', wo],
  ['Meze Audio POET', wo], ['Meze 109 Pro', wo], ['Meze Audio 109 Pro', wo], ['Meze 105', wo], ['Meze Audio 105', wo],
  ['Meze Strada', wo], ['Meze Audio Strada', wo],
  ['ZMF Verite', wo], ['ZMF Verite Closed', wc], ['ZMF Aeolus', wo], ['ZMF Atrium', wo], ['ZMF Atrium Closed', wc],
  ['ZMF Auteur', wo], ['ZMF Atticus', wc], ['ZMF Eikon', wc], ['ZMF Bokeh', wc], ['ZMF Bokeh Open', wo],
  ['ZMF Caldera', wo], ['ZMF Caldera Closed', wc],
  ['Dan Clark Audio Aeon 2 Closed', wc], ['Dan Clark Audio Aeon 2 Noire', wc], ['Dan Clark Audio Aeon 2 Open', wo],
  ['Dan Clark Audio Aeon X Closed', wc], ['Dan Clark Audio Aeon X Open', wo], ['Dan Clark Audio Aeon Open', wo],
  ['Dan Clark Audio Aeon Flow Open', wo], ['Dan Clark Audio Aeon Flow Closed', wc], ['Dan Clark Audio Aeon Closed', wc],
  ['Dan Clark Audio Ether 2', wo], ['Dan Clark Audio Ether Flow', wo], ['Dan Clark Audio Ether C', wc],
  ['Dan Clark Audio Ether CX', wc], ['Dan Clark Audio EXPANSE', wo], ['Dan Clark Audio Stealth', wc],
  ['Dan Clark Audio Noire X Open', wo], ['Dan Clark Audio Noire XO', wo], ['Dan Clark Audio Noire X', wc],
  ['Dan Clark Audio Noir X', wc], ['Dan Clark Audio Mad Dog', wc], ['Dan Clark Audio Alpha Dog', wc],
  ['Dan Clark Audio Alpha Prime', wc], ['Dan Clark Audio E3', wc], ['Dan Clark Aeon Closed X', wc],
  ['Dan Clark Audio + Drop Aeon Closed X', wc],
  ['DCA Aeon 2 Closed', wc], ['DCA Aeon 2 Noire', wc], ['DCA Aeon Closed X', wc], ['DCA Aeon Flow Closed', wc],
  ['DCA Aeon Open X', wo], ['DCA Aeon RT Closed', wc], ['DCA Aeon RT Open', wo], ['DCA Ether CX', wc], ['DCA Expanse', wo],

  // ---- Fostex / Shure / Ultrasone / Final / Denon ----
  ['Fostex T50RP', ws], ['Fostex T40RP', wc], ['Fostex T60RP', wc], ['Fostex TH900', wc], ['Fostex TH-X00', wc],
  ['Fostex TH600', wc], ['Fostex TH610', wc], ['Fostex TH500RP', wo], ['Fostex TH909', wo], ['Fostex TH808', wo],
  ['Fostex TH616', wo], ['Fostex TR-X00', wc], ['Fostex TRX00', wc],
  ['Shure SRH1440', wo], ['Shure SRH1840', wo], ['Shure SRH1540', wc], ['Shure SRH240', wc], ['Shure SRH440', wc],
  ['Shure SRH750DJ', wc], ['Shure SRH840', wc], ['Shure SRH940', wc],
  ['Shure AONIC 50', w(bothAnc, ['SBC', 'AAC', 'aptX', 'aptX HD', 'LDAC'])], ['Shure AONIC 50 Gen 2', bothAnc],
  ['Ultrasone Edition 8', wc], ['Ultrasone Edition 10', wo], ['Ultrasone Edition 11', wo], ['Ultrasone Signature', wc],
  ['Ultrasone Signature Fusion Open', wo], ['Ultrasone PRO', wc], ['Ultrasone PROline', wc], ['Ultrasone HFI-580', wc],
  ['Ultrasone HFI-780', wc], ['Ultrasone HFI-2400', wo],
  ['Final D8000', wo], ['Final Audio D8000', wo], ['Final D7000', wo], ['Final Audio D7000', wo],
  ['Final Audio Sonorous', wc], ['Final Sonorous', wc], ['Final UX3000', bcAnc], ['Final Audio UX3000', bcAnc],
  ['Final Audio Pandora', wc],
  ['Denon AH-D', wc], ['Denon D2000', wc], ['Denon D5200', wc], ['Denon D7000', wc], ['Denon D7200', wc],
  ['Denon AH-NC732', wcAnc], ['Denon AH-D400', {}],

  // ---- 무선 위주 브랜드 ----
  ['Sonos Ace', w(bothAnc, ['SBC', 'AAC', 'aptX Adaptive', 'aptX Lossless'])],
  ['Nothing Headphone', w(bothAnc, SBC_AAC_LDAC)], ['Dyson OnTrac', bcAnc],
  ['Bowers & Wilkins Px7 S2', w(bothAnc, ['SBC', 'AAC', 'aptX HD', 'aptX Adaptive'])],
  ['Bowers & Wilkins Px8', w(bothAnc, ['SBC', 'AAC', 'aptX HD', 'aptX Adaptive'])],
  ['Bowers & Wilkins PX7', bothAnc], ['Bowers & Wilkins Px7', bothAnc], ['Bowers & Wilkins PX5', bcAnc],
  ['Bowers & Wilkins PX8', bothAnc], ['B&W Px8', bothAnc], ['Bowers & Wilkins PX', bcAnc],
  ['Bowers & Wilkins P5 Wireless', bc], ['Bowers & Wilkins P7 Wireless', bc], ['Bowers & Wilkins P5', wc],
  ['Bowers & Wilkins P7', wc], ['Bowers & Wilkins P3', wc],
  ['Bang & Olufsen Beoplay H9', bothAnc], ['Bang & Olufsen Beoplay H95', bothAnc], ['Bang & Olufsen Beoplay Portal', bcAnc],
  ['Bang & Olufsen Beoplay H6', wc], ['Mark Levinson No 5909', bothAnc],
  ['Anker Soundcore Life Q', bcAnc], ['Anker Soundcore Space Q45', w(bothAnc, SBC_AAC_LDAC)],
  ['Soundcore Space Q45', w(bothAnc, SBC_AAC_LDAC)], ['Soundcore Q45', w(bothAnc, SBC_AAC_LDAC)],
  ['Anker Soundcore Space One', w(bothAnc, SBC_AAC_LDAC)],
  ['JBL Tour One', bothAnc], ['JBL Live', bc], ['JBL Live 460NC', bcAnc], ['JBL Live 650BTNC', bcAnc],
  ['JBL Live 660NC', bcAnc], ['JBL Live 670NC', bcAnc], ['JBL Live 770NC', bcAnc], ['JBL Live 780NC', bcAnc],
  ['JBL Tune 510BT', bc], ['JBL Tune 520BT', bc], ['JBL Tune 710BT', bc], ['JBL Tune 720BT', bc],
  ['JBL Tune 660NC', bcAnc], ['JBL Tune 760NC', bcAnc], ['JBL TUNE760', bcAnc], ['JBL Tune 770NC', bcAnc],
  ['JBL TUNE 750BTNC', bcAnc], ['JBL CLUB 700BT', bc], ['JBL CLUB 950NC', bcAnc], ['JBL CLUB ONE', bcAnc],
  ['JBL E45BT', bc], ['JBL E55BT', bc], ['JBL E65BTNC', bcAnc], ['JBL Everest Elite 750NC', bcAnc],
  ['JBL Everest Elite 700', bcAnc], ['JBL Quantum 100', wc], ['JBL Quantum 300', wc], ['JBL Quantum 400', wc],
  ['JBL Quantum 800', bcAnc], ['JBL Quantum 910X', bcAnc],
  ['Edifier W820NB', bcAnc], ['Edifier W830NB', bcAnc], ['Edifier WH950NB', bcAnc], ['Edifier WH700NB', bcAnc],
  ['Edifier STAX Spirit S3', bc], ['Edifier Stax Spirit S3', bc],
  ['Marshall MID ANC', bcAnc], ['Marshall Major III', { acoustic: 'closed' }], ['Marshall Major V', bc], ['Marshall Major 3 BT', bc],
  ['Jabra Elite 85h', bcAnc], ['Jabra Evolve2 85', bcAnc], ['Jabra Evolve2 65', bc],
  ['Microsoft Surface Headphones', bcAnc], ['Microsoft Xbox Wireless Headset', bc], ['Xbox Wireless Headset', bc],
  ['Xbox Stereo Headset', wc], ['Parrot Zik', bcAnc], ['Plantronics BackBeat Pro', bcAnc],
  ['Plantronics Backbeat Pro', bcAnc], ['Plantronics Backbeat Go 810', bcAnc],
  ['Beyerdynamic Aventho 100', bc], ['Cambridge Audio Melomania P100', bcAnc],
  ['V-MODA Crossfade Wireless', bc], ['V-MODA Crossfade 2 Wireless', bc], ['V-MODA Crossfade 3 Wireless', bc],
  ['V-MODA Crossfade M-100', wc], ['V-MODA M100', wc], ['V-MODA Crossfade LP', wc], ['V-MODA LP2', wc],
  ['V-MODA Crossfade M-80', wc], ['V-MODA XS', wc], ['V-MODA M-200', wc],
  ['Skullcandy Crusher Wireless', bc], ['Skullcandy Crusher Evo', bc], ['Skullcandy Crusher 360', bc],
  ['Skullcandy Hesh 3', bc], ['Skullcandy Hesh ANC', bcAnc], ['Skullcandy Hesh Evo', bc], ['Skullcandy Venue', bcAnc],
  ['Skullcandy Grind Wireless', bc], ['Skullcandy Riff Wireless', bc],
  ['Master & Dynamic MH40', wc], ['Master and Dynamic MH40', wc], ['Master & Dynamic MH30', wc],

  // ---- 게임용 헤드셋(유선/무선이 이름에 드러나는 것만) ----
  ['HyperX Cloud', wc], ['HyperX CloudX', wc], ['HyperX Cloud Flight', bc], ['HyperX Cloud Alpha Wireless', bc],
  ['HyperX Cloud Alpha 2 Wireless', bc], ['HyperX Cloud II Wireless', bc], ['HyperX Cloud III Wireless', bc],
  ['HyperX Cloud IIIS Wireless', bc], ['HyperX Cloud Core Wireless', bc], ['HyperX Cloud Stinger 2', wc],
  ['HyperX Cloud Mix', bc],
  ['SteelSeries Arctis 1', wc], ['SteelSeries Arctis 1 Wireless', bc], ['SteelSeries Arctis 3', wc],
  ['SteelSeries Arctis 5', wc], ['SteelSeries Arctis 7', bc], ['SteelSeries Arctis 9', bc],
  ['SteelSeries Arctis Pro', wc], ['SteelSeries Arctis Nova 1', wc], ['SteelSeries Nova 1', wc],
  ['SteelSeries Arctis Nova 3', wc], ['SteelSeries Nova 3', wc], ['SteelSeries Nova 3 Wireless', bc],
  ['SteelSeries Arctis Nova 5', bc], ['SteelSeries Nova 5', bc], ['SteelSeries Arctis Nova 7', bc],
  ['SteelSeries Nova 7', bc], ['SteelSeries Arctis Nova Pro Wireless', bcAnc], ['SteelSeries Nova Pro Wireless', bcAnc],
  ['SteelSeries Arctis Nova Pro', wc], ['SteelSeries Nova Pro Wired', wc],
  ['Logitech G PRO X 2', bc], ['Logitech G Pro 2 X Lightspeed', bc], ['Logitech G PRO X LIGHTSPEED', bc],
  ['Logitech G Pro X', wc], ['Logitech G Pro Gaming Headset', wc], ['Logitech G430', wc], ['Logitech G432', wc],
  ['Logitech G433', wc], ['Logitech G331', wc], ['Logitech G335', wc], ['Logitech G635', wc], ['Logitech G435', bc],
  ['Logitech G533', bc], ['Logitech G535', bc], ['Logitech G733', bc], ['Logitech G735', bc], ['Logitech G930', bc],
  ['Logitech G933', bc], ['Logitech G935', bc], ['Logitech G522', bc],
  ['Razer BlackShark V2', wc], ['Razer Blackshark V2', wc], ['Razer BlackShark V2 Pro', bc],
  ['Razer BlackShark V2 HyperSpeed', bc], ['Razer BlackShark V3 Pro', bcAnc],
  ['Razer BlackShark V3 X HyperSpeed', bc], ['Razer Kraken', wc], ['Razer Kraken V3 Pro', bc], ['Razer Kraken V4', bc],
  ['Razer Kraken V4 Pro', bc], ['Razer Barracuda', bc], ['Razer Barracuda Pro', bcAnc], ['Razer Kaira', bc], ['Razer Kaira X', wc],
  ['Razer Nari', bc], ['Razer Opus', bcAnc], ['Razer Man O\'War', bc],
  ['Corsair HS35', wc], ['Corsair HS50', wc], ['Corsair HS55 Wireless', bc], ['Corsair HS60', wc],
  ['Corsair HS65 Surround', wc], ['Corsair HS65 Wireless', bc], ['Corsair HS70', bc], ['Corsair HS75', bc],
  ['Corsair HS80 RGB WIRELESS', bc], ['Corsair HS80 MAX WIRELESS', bc], ['Corsair Virtuoso RGB Wireless', bc], ['Corsair Virtuoso Max', bcAnc],
  ['Corsair VIRTUOSO PRO', wc], ['Corsair Virtuoso Pro', wc], ['Corsair Void v2 Wireless', bc],
  ['Corsair Void v2 MAX Wireless', bc],
  ['ASTRO A10', { connection: 'wired' }], ['ASTRO Gaming A10', { connection: 'wired' }],
  ['ASTRO A40', { connection: 'wired', acoustic: 'open' }], ['ASTRO Gaming A40', { connection: 'wired', acoustic: 'open' }],
  ['ASTRO A20', { connection: 'wireless' }], ['ASTRO Gaming A20', { connection: 'wireless' }],
  ['ASTRO A30', { connection: 'wireless' }], ['ASTRO Gaming A30', { connection: 'wireless' }],
  ['ASTRO A50', { connection: 'wireless' }], ['ASTRO Gaming A50', { connection: 'wireless' }],
  ['Turtle Beach Stealth', bc], ['Turtle Beach Stealth 300', wc], ['Turtle Beach Recon', wc], ['Turtle Beach Atlas 200', wc],
  ['Turtle Beach Atlas Air', bo], ['Turtle Beach Elite 800', bcAnc], ['Turtle Beach Elite Pro 2', wc],
  ['Turtle Beach Elite Atlas', wc], ['Turtle Beach Elite Atlas Aero', bc],
  ['Audeze Maxwell 2', w(bc, SBC_AAC_LDAC)],

  // ---- 그 밖에 확실한 모델 ----
  ['Austrian Audio Hi-X15', wc], ['Austrian Audio Hi-X20', wc], ['Austrian Audio Hi-X55', wc], ['Austrian Audio Hi-X60', wc],
  ['Austrian Audio Hi-X65', wo], ['Austrian Audio The Composer', wo], ['Austrian Audio Composer', wo],
  ['Austrian Composer', wo], ['Rode NTH-100', wc], ['RØDE NTH-100', wc],
  ['Takstar Pro 80', wc], ['Takstar Pro 82', wc], ['Superlux HD 668B', ws], ['Superlux HD 681', ws],
  ['Superlux Hd 681', ws], ['Samson SR850', ws], ['Monoprice M1570C', wc], ['Monoprice M1570', wo],
  ['Monolith M570', wo], ['Monoprice M1060', wo], ['Massdrop Panda', bc], ['Drop Panda', bc],
  ['Fostex T50RP Mk3', ws], ['Mayflower Electronics T50RP', ws], ['Modhouse Audio T60RP Argon', wc],
  ['Yamaha YH-5000SE', wo], ['Yamaha YH-E700A', bcAnc], ['Yamaha HPH-MT5', wc], ['Yamaha HPH-MT8', wc],
  ['Fiio FT3', wo], ['FiiO FT3', wo], ['FiiO FT5', wo], ['FiiO FT1', wc], ['Sivga Phoenix', wo],
  ['Sivga Audio Phoenix', wo], ['Sivga P2 Pro', wo], ['Sivga P2-Pro', wo], ['Sivga Luan', wo],
  ['Moondrop Para', wo], ['Moondrop Venus', wo], ['Moondrop Cosmo', wo], ['Moondrop Void', wo],
  ['Warwick Acoustics', wo], ['Sennheiser Urbanite', { acoustic: 'closed' }],
]
