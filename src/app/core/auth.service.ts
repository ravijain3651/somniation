import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { User } from 'firebase/auth';

/**
 * Auth state for the whole app. Firebase is only loaded in the browser (dynamic import),
 * so server-rendered HTML never depends on the signed-in user.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly user = signal<User | null>(null);
  readonly isAdmin = signal(false);
  readonly signedIn = computed(() => this.user() !== null);
  /** Resolves once the initial auth state (and admin flag) is known. */
  readonly ready: Promise<void> = this.browser ? this.init() : Promise.resolve();

  /** Where a signed-in user lands by default. */
  landingUrl(): string {
    return this.isAdmin() ? '/admin' : '/timesheet';
  }

  async signIn(email: string, password: string): Promise<void> {
    const [{ getFirebase }, { signInWithEmailAndPassword }] = await Promise.all([
      import('./firebase/client'),
      import('firebase/auth'),
    ]);
    const cred = await signInWithEmailAndPassword(getFirebase().auth, email, password);
    this.isAdmin.set(await this.checkAdmin(cred.user.uid));
    this.user.set(cred.user);
  }

  async signOut(): Promise<void> {
    const [{ getFirebase }, { signOut }] = await Promise.all([
      import('./firebase/client'),
      import('firebase/auth'),
    ]);
    await signOut(getFirebase().auth);
  }

  private async init(): Promise<void> {
    const [{ getFirebase }, { onAuthStateChanged }] = await Promise.all([
      import('./firebase/client'),
      import('firebase/auth'),
    ]);
    return new Promise<void>((resolve) => {
      onAuthStateChanged(getFirebase().auth, async (user) => {
        const admin = user ? await this.checkAdmin(user.uid) : false;
        this.isAdmin.set(admin);
        this.user.set(user);
        resolve();
      });
    });
  }

  private async checkAdmin(uid: string): Promise<boolean> {
    const [{ getFirebase }, { doc, getDoc }] = await Promise.all([
      import('./firebase/client'),
      import('firebase/firestore'),
    ]);
    try {
      return (await getDoc(doc(getFirebase().db, 'admins', uid))).exists();
    } catch {
      return false;
    }
  }
}
