import { TestBed } from '@angular/core/testing';

import { TRANSLATIONS, TranslationService } from './translation.service';

/**
 * Ces tests verrouillent l'intégrité du dictionnaire fr/en.
 *
 * Le moteur de traduction lui-même (`t()`) est trivial ; ce qui casse en
 * pratique, c'est le *contenu* du dictionnaire : une clé ajoutée d'un seul
 * côté, ou un paramètre `{{ n }}` présent en français mais oublié en anglais.
 * Dans les deux cas l'utilisateur voit un texte brut ou un trou dans la phrase.
 */
describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationService);
    localStorage.clear();
    service.lang = 'fr';
  });

  afterEach(() => localStorage.clear());

  // ---------------------------------------------------------------- dictionnaire

  it('a exactement les mêmes clés en fr et en en', () => {
    const fr = Object.keys(TRANSLATIONS.fr).sort();
    const en = Object.keys(TRANSLATIONS.en).sort();

    const sansTraduction = fr.filter(k => !(k in TRANSLATIONS.en));
    const orphelinesEn = en.filter(k => !(k in TRANSLATIONS.fr));

    expect(sansTraduction).withContext(`clés fr sans équivalent en : ${sansTraduction}`).toEqual([]);
    expect(orphelinesEn).withContext(`clés en sans équivalent fr : ${orphelinesEn}`).toEqual([]);
  });

  it("n'a aucune valeur vide", () => {
    for (const lang of ['fr', 'en'] as const) {
      const vides = Object.entries(TRANSLATIONS[lang])
        .filter(([, valeur]) => !valeur || !valeur.trim())
        .map(([cle]) => `${lang}:${cle}`);

      expect(vides).withContext(`clés sans texte : ${vides}`).toEqual([]);
    }
  });

  it('déclare les mêmes paramètres {{ … }} dans les deux langues', () => {
    const parametres = (texte: string): string[] =>
      (texte.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? []).map(p => p.replace(/[{}\s]/g, '')).sort();

    const divergentes: string[] = [];
    for (const [cle, valeurFr] of Object.entries(TRANSLATIONS.fr)) {
      const valeurEn = TRANSLATIONS.en[cle];
      if (parametres(valeurFr).join(',') !== parametres(valeurEn).join(',')) {
        divergentes.push(cle);
      }
    }

    expect(divergentes).withContext(`paramètres différents selon la langue : ${divergentes}`).toEqual([]);
  });

  // ------------------------------------------------------------------------ t()

  it('retourne le texte de la langue active', () => {
    service.lang = 'fr';
    expect(service.t('login.submit')).toBe('Se connecter');

    service.lang = 'en';
    expect(service.t('login.submit')).toBe('Sign In');
  });

  it('retourne la clé elle-même quand elle est inconnue', () => {
    expect(service.t('cle.qui.n.existe.pas')).toBe('cle.qui.n.existe.pas');
  });

  it('substitue les paramètres nommés', () => {
    expect(service.t('toast.reservation.cancelled', { name: 'Dune' }))
      .toBe('Réservation pour « Dune » annulée avec succès');
  });

  it('substitue aussi un paramètre numérique', () => {
    expect(service.t('common.places.remaining', { n: 2 }))
      .toBe('2 place(s) restante(s)');
  });

  it('laisse le gabarit intact si le paramètre attendu est absent', () => {
    expect(service.t('toast.reservation.cancelled')).toContain('{{ name }}');
  });

  // ----------------------------------------------------------------- les clés

  it('conserve la langue choisie entre deux sessions', () => {
    service.lang = 'en';
    const relu = TestBed.inject(TranslationService);
    expect(relu.lang).toBe('en');
  });
});
