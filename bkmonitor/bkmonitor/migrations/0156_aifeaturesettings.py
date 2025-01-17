# Generated by Django 3.2.15 on 2024-01-15 13:30
import logging

from django.db import migrations, models

import bkmonitor.utils.db.fields
from constants.aiops import AI_SETTING_APPLICATION_CONFIG_KEY

logger = logging.getLogger("bkmonitor")


def migrate_ai_settings(apps, *args, **kwargs):
    """迁移AI开关配置."""
    AIFeatureSettings = apps.get_model("bkmonitor", "AIFeatureSettings")
    ApplicationConfig = apps.get_model("monitor", "ApplicationConfig")
    application_configs = ApplicationConfig.objects.filter(key=AI_SETTING_APPLICATION_CONFIG_KEY)
    for application_config in application_configs:
        try:
            AIFeatureSettings.objects.get_or_create(
                bk_biz_id=application_config.cc_biz_id,
                defaults={
                    "config": application_config.value,
                },
            )
            logger.info(f"迁移空间{application_config.cc_biz_id}的AI配置成功")
        except Exception as e:  # pylint: disable=broad-except
            logger.error(f"迁移空间{application_config.cc_biz_id}的AI配置失败: {e}")


def reverse_migrate_ai_settings(apps, *args, **kwargs):
    """迁移AI开关配置."""
    AIFeatureSettings = apps.get_model("bkmonitor", "AIFeatureSettings")
    AIFeatureSettings.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('bkmonitor', '0155_auto_20231229_1136'),
    ]

    operations = [
        migrations.CreateModel(
            name='AIFeatureSettings',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bk_biz_id', models.IntegerField(db_index=True, verbose_name='业务ID')),
                ('config', bkmonitor.utils.db.fields.JsonField(verbose_name='配置信息')),
                ('create_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('update_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={
                'verbose_name': 'AI功能配置',
                'verbose_name_plural': 'AI功能配置',
                'db_table': 'ai_feature_settings',
                'unique_together': {('bk_biz_id',)},
            },
        ),
        migrations.RunPython(code=migrate_ai_settings, reverse_code=reverse_migrate_ai_settings),
    ]
