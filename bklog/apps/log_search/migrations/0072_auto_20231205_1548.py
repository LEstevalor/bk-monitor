# Generated by Django 3.2.15 on 2023-12-05 07:48

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('log_search', '0071_merge_20231124_1958'),
    ]

    operations = [
        migrations.AddField(
            model_name='indexsetfieldsconfig',
            name='index_set_ids',
            field=models.JSONField(default=list, null=True, verbose_name='索引集ID列表'),
        ),
        migrations.AddField(
            model_name='indexsetfieldsconfig',
            name='index_set_ids_hash',
            field=models.CharField(db_index=True, default='', max_length=32, null=True, verbose_name='索引集ID哈希'),
        ),
        migrations.AddField(
            model_name='indexsetfieldsconfig',
            name='index_set_type',
            field=models.CharField(
                choices=[('single', '单索引集'), ('union', '联合索引集')], default='single', max_length=32, verbose_name='索引集类型'
            ),
        ),
        migrations.AddField(
            model_name='userindexsetfieldsconfig',
            name='index_set_ids',
            field=models.JSONField(default=list, null=True, verbose_name='索引集ID列表'),
        ),
        migrations.AddField(
            model_name='userindexsetfieldsconfig',
            name='index_set_ids_hash',
            field=models.CharField(db_index=True, default='', max_length=32, null=True, verbose_name='索引集ID哈希'),
        ),
        migrations.AddField(
            model_name='userindexsetfieldsconfig',
            name='index_set_type',
            field=models.CharField(
                choices=[('single', '单索引集'), ('union', '联合索引集')], default='single', max_length=32, verbose_name='索引集类型'
            ),
        ),
        migrations.AlterField(
            model_name='indexsetfieldsconfig',
            name='index_set_id',
            field=models.IntegerField(blank=True, db_index=True, null=True, verbose_name='索引集ID'),
        ),
        migrations.AlterField(
            model_name='userindexsetfieldsconfig',
            name='config_id',
            field=models.IntegerField(db_index=True, verbose_name='索引集配置ID'),
        ),
        migrations.AlterField(
            model_name='userindexsetfieldsconfig',
            name='index_set_id',
            field=models.IntegerField(blank=True, db_index=True, null=True, verbose_name='索引集ID'),
        ),
        migrations.AlterUniqueTogether(
            name='indexsetfieldsconfig',
            unique_together={('index_set_id', 'index_set_ids_hash', 'name', 'scope', 'source_app_code')},
        ),
        migrations.AlterUniqueTogether(
            name='userindexsetfieldsconfig',
            unique_together={('index_set_id', 'index_set_ids_hash', 'username', 'scope', 'source_app_code')},
        ),
        migrations.CreateModel(
            name='FavoriteUnionSearch',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='创建时间')),
                ('created_by', models.CharField(default='', max_length=32, verbose_name='创建者')),
                ('updated_at', models.DateTimeField(auto_now=True, db_index=True, null=True, verbose_name='更新时间')),
                ('updated_by', models.CharField(blank=True, default='', max_length=32, verbose_name='修改者')),
                ('space_uid', models.CharField(max_length=256, verbose_name='空间唯一标识')),
                ('username', models.CharField(db_index=True, max_length=255, verbose_name='用户名')),
                ('name', models.CharField(max_length=64, verbose_name='收藏名称')),
                ('index_set_ids', models.JSONField(verbose_name='索引集ID列表')),
            ],
            options={
                'verbose_name': '联合检索组合收藏',
                'verbose_name_plural': '34_搜索-联合检索组合收藏',
                'ordering': ('-updated_at',),
                'unique_together': {('space_uid', 'username', 'name')},
            },
        ),
    ]
