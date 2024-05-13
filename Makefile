SPK_NAME = rr-manager
SPK_VERS = 2.0
SPK_REV = 38
SPK_ICON = src/rr-manager.png

DSM_UI_DIR = ui
DSM_UI_CONFIG = src/ui/config
DSM_APP_NAME = SYNOCOMMUNITY.RRManager.AppInstance

PYTHON_PACKAGE = python311
SPK_DEPENDS = "python311>=3.11.5-8"

MAINTAINER = T-REX-XP

DESCRIPTION = RR Manager is a Redpill Recovery DSM application aimed to provide the ability to configure/update RR without booting to RR recovery. This package is for experienced users.
STARTABLE = no
DISPLAY_NAME = RR Manager

HOMEPAGE = https://github.com/T-REX-XP/RRManager

CONF_DIR = src/conf
SYSTEM_GROUP = http

SERVICE_USER   = auto
SERVICE_SETUP  = src/service-setup.sh
SSS_SCRIPT = src/dsm-control.sh
COPY_TARGET = nop
POST_STRIP_TARGET = rr-manager_extra_install


include ../../mk/spksrc.common.mk
include ../../mk/spksrc.directories.mk
SERVICE_WIZARD_SHARE = wizard_download_dir
WIZARDS_DIR = $(WORK_DIR)/generated-wizards
WIZARDS = install_uifile upgrade_uifile
SUPPORTED_LANGUAGES = fre

wizards: generated-wizards
include ../../mk/spksrc.spk.mk

.PHONY: generated-wizards
generated-wizards:
	@mkdir -p $(WIZARDS_DIR)
	@for template in $(WIZARDS); do \
		for suffix in '' $(patsubst %,_%,$(SUPPORTED_LANGUAGES)) ; do \
			{\
			  	echo "#!/bin/sh";\
				echo "";\
				cat src/wizard_templates/uifile_vars$${suffix} | sed -e 's/\\/\\\\/g' -e 's/\"/\\\"/g' -e 's/^\([^=]*\)=\\"\(.*\)\\"$$/\1="\2"/g';\
				echo "";\
				cat "$(SPKSRC_MK)spksrc.service.installer.functions";\
				echo "";\
				cat src/wizard_templates/shared_uifile_setup.sh;\
				echo "";\
				cat src/wizard_templates/$${template}.sh;\
			}>$(WIZARDS_DIR)/$${template}$${suffix}.sh;\
		done;\
	done

.PHONY: rr-manager_extra_install
rr-manager_extra_install:
	install -m 755 -d $(STAGING_DIR)/share $(STAGING_DIR)/var
	install -m 755 -d $(STAGING_DIR)/share/wheelhouse/
	install -m 644 src/requirements.txt $(STAGING_DIR)/share/wheelhouse/requirements.txt

	install -m 755 -d $(STAGING_DIR)/ui/
	install -m 755 -d $(STAGING_DIR)/ui/libs/
	install -m 755 src/ui/getConfig.cgi $(STAGING_DIR)/ui/getConfig.cgi
	install -m 755 src/ui/getNetworkInfo.cgi $(STAGING_DIR)/ui/getNetworkInfo.cgi
	install -m 755 src/ui/getRrReleaseInfo.cgi $(STAGING_DIR)/ui/getRrReleaseInfo.cgi
	install -m 755 src/ui/config.txt $(STAGING_DIR)/ui/config.txt
	install -m 755 src/ui/style.css $(STAGING_DIR)/ui/style.css
	install -m 755 src/ui/getAddons.cgi $(STAGING_DIR)/ui/getAddons.cgi
	install -m 755 src/ui/getModules.cgi $(STAGING_DIR)/ui/getModules.cgi
	install -m 755 src/ui/readUpdateFile.cgi $(STAGING_DIR)/ui/readUpdateFile.cgi
	install -m 755 src/ui/uploadConfigFile.cgi $(STAGING_DIR)/ui/uploadConfigFile.cgi
	install -m 755 src/ui/checkUpdateStatus.cgi $(STAGING_DIR)/ui/checkUpdateStatus.cgi
	install -m 755 src/ui/getAvailableUpdates.cgi $(STAGING_DIR)/ui/getAvailableUpdates.cgi
	install -m 755 src/ui/uploadUpdateFileInfo.cgi $(STAGING_DIR)/ui/uploadUpdateFileInfo.cgi
	install -m 644 src/ui/config $(STAGING_DIR)/ui/config
	install -m 644 src/ui/rr-manager.js $(STAGING_DIR)/ui/rr-manager.js
	install -m 644 src/ui/rr-manager.widget.js $(STAGING_DIR)/ui/rr-manager.widget.js
	install -m 644 src/ui/helptoc.conf $(STAGING_DIR)/ui/helptoc.conf
	install -m 755 -d $(STAGING_DIR)/ui/help
	for language in enu fre; do \
		install -m 755 -d $(STAGING_DIR)/ui/help/$${language}; \
		install -m 644 src/ui/help/$${language}/simpleapp_index.html $(STAGING_DIR)/ui/help/$${language}/simpleapp_index.html; \
	done
	install -m 755 -d $(STAGING_DIR)/ui/texts
	for language in enu rus chs cht krn; do \
		install -m 755 -d $(STAGING_DIR)/ui/texts/$${language}; \
		install -m 644 src/ui/texts/$${language}/strings $(STAGING_DIR)/ui/texts/$${language}/strings; \
	done
