import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ContactInfoService } from '../../core/contact-info.service';
import { SERVICES } from '../../core/data';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  protected readonly services = SERVICES;
  protected readonly contact = inject(ContactInfoService).info;
  protected readonly auth = inject(AuthService);
  protected readonly year = new Date().getFullYear();

  protected signOut(): void {
    void this.auth.signOut();
  }
}

