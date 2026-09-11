import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitorComponent } from './components/monitor/monitor.component';
import { DatabaseLogComponent } from './components/database-log/database-log.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MonitorComponent, DatabaseLogComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'AuraGreet';
}
