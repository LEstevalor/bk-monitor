# Generated by Django 3.2.15 on 2023-12-25 10:37

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('bkmonitor', '0149_monitormigration'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventplugininstance',
            name='clean_configs',
            field=models.JSONField(default=list, verbose_name='条件清洗配置'),
        ),
        migrations.AddField(
            model_name='eventpluginv2',
            name='clean_configs',
            field=models.JSONField(default=list, verbose_name='条件清洗配置'),
        ),
        migrations.AlterField(
            model_name='eventplugin',
            name='plugin_type',
            field=models.CharField(
                choices=[
                    ('http_push', 'HTTP 推送'),
                    ('http_pull', 'HTTP 拉取'),
                    ('email_pull', 'Email 拉取'),
                    ('kafka_push', 'kafka 推送'),
                    ('bk_collector', 'HTTP 推送'),
                ],
                db_index=True,
                max_length=32,
                verbose_name='插件类型',
            ),
        ),
        migrations.AlterField(
            model_name='eventpluginv2',
            name='plugin_type',
            field=models.CharField(
                choices=[
                    ('http_push', 'HTTP 推送'),
                    ('http_pull', 'HTTP 拉取'),
                    ('email_pull', 'Email 拉取'),
                    ('kafka_push', 'kafka 推送'),
                    ('bk_collector', 'HTTP 推送'),
                ],
                db_index=True,
                max_length=32,
                verbose_name='插件类型',
            ),
        ),
    ]
