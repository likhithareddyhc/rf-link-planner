import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-shell">
      <header>
        <h1>RF Link Planner (Angular)</h1>
        <p>Click map to add towers. Click tower A then B to create link (frequency must match).</p>
      </header>
      <main>
        <app-map></app-map>
      </main>
    </div>
  `,
  styles: [`
    .app-shell { display:flex; flex-direction:column; height:100vh; }
    header { padding:12px; background:#0d6efd; color:white; }
    main { flex:1; }
    h1 { margin:0; font-size:18px }
  `]
})
export class AppComponent {}
